import csv
import json
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from zipfile import ZipFile
import xml.etree.ElementTree as ET

from pipeline.generate import (
    ROOT,
    TZ,
    simulate_patient,
    xml_export,
    classify,
    partition,
    write_zip,
)
from pipeline.health import sleep_nights, PREFIX, KIND


def record(stage, a, b, source="Simulated Watch"):
    return dict(
        type=KIND, sourceName=source, value=PREFIX + stage, startDate=a, endDate=b
    )


def records(*entries):
    root = ET.Element("HealthData")
    for row in entries:
        ET.SubElement(root, "Record", **row)
    return ET.tostring(root)


class SleepDataTests(unittest.TestCase):
    def test_overlapping_in_bed_is_excluded(self):
        a, b, c, d = [
            "2026-10-03 " + t + " +0200"
            for t in ("00:00:00", "01:00:00", "01:10:00", "03:00:00")
        ]
        parsed = sleep_nights(
            records(
                record("InBed", a, d, "Diary"),
                record("AsleepCore", a, b),
                record("Awake", b, c),
                record("AsleepREM", c, d),
            ),
            TZ,
        )
        night = parsed["2026-10-03"]
        self.assertEqual((night["sleep"], night["awake"], night["bouts"]), (170, 10, 1))

    def test_autumn_clock_change_preserves_elapsed_time_and_wake_date(self):
        a, b = "2026-10-25 02:30:00 +0200", "2026-10-25 02:30:00 +0100"
        n = sleep_nights(records(record("AsleepUnspecified", a, b)), TZ)["2026-10-25"]
        self.assertEqual(n["runs"], [["U", 60]])

    def test_invalid_input_rejected(self):
        a, b, c, d = [
            "2026-10-03 " + t + " +0200"
            for t in ("00:00:00", "01:00:00", "01:10:00", "03:00:00")
        ]
        cases = [
            [record("AsleepCore", a, b), record("AsleepDeep", a, d)],
            [record("AsleepCore", a, b), record("AsleepREM", c, d)],
            [record("AsleepCore", a, b), record("AsleepDeep", b, c, "Other source")],
            [record("Awake", a, b)],
            [record("AsleepCore", b, a)],
            [record("Fake", a, b)],
        ]
        for case in cases:
            with self.subTest(case=case), self.assertRaises(ValueError):
                sleep_nights(records(*case), TZ)

    def test_whole_duration_with_off_minute_boundaries_is_rejected(self):
        sample = record(
            "AsleepCore", "2026-10-03 00:00:15 +0200", "2026-10-03 01:00:15 +0200"
        )
        with self.assertRaisesRegex(ValueError, "aligned"):
            sleep_nights(records(sample), TZ)

    def test_midnight_unsorted_and_adjacent_same_stage(self):
        a, b, c = (
            "2026-10-03 23:30:00 +0200",
            "2026-10-04 01:00:00 +0200",
            "2026-10-04 03:00:00 +0200",
        )
        n = sleep_nights(
            records(record("AsleepCore", b, c), record("AsleepCore", a, b)), TZ
        )["2026-10-04"]
        self.assertEqual(n["runs"], [["C", 210]])

    def test_group_rules_and_minimum_coverage(self):
        for value, expected in (
            (2, "fewer"),
            (2.1, "intermediate"),
            (4.9, "intermediate"),
            (5, "frequent"),
        ):
            self.assertEqual(classify([{"bouts": value}] * 4 + [None] * 3), expected)
        self.assertEqual(classify([{"bouts": 2}] * 3 + [None] * 4), "unclassified")

    def test_reproducible_records_and_archived_xml(self):
        pid, nights, diary = simulate_patient(7)
        self.assertEqual((pid, nights, diary), simulate_patient(7))
        raw = xml_export(nights, pid)
        member = "apple_health_export/export.xml"
        published = ROOT / "data" / "apple_health" / f"{pid}.zip"
        with TemporaryDirectory() as tmp:
            regenerated = Path(tmp) / "regenerated.zip"
            write_zip(regenerated, raw)
            # ZIP headers can vary across platforms even when the export is identical.
            for path in (regenerated, published):
                with self.subTest(archive=path.name), ZipFile(path) as archive:
                    self.assertEqual(archive.namelist(), [member])
                    self.assertEqual(archive.read(member), raw)

    def test_integer_allocation(self):
        for total in range(10, 120):
            self.assertEqual(sum(partition(total, [1.4, 3, 0.82, 4.5])), total)


class DeliveredDataTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        data = ROOT / "data"
        script = (data / "dashboard.js").read_text()
        cls.payload = json.loads(
            script.removeprefix("window.SLEEP_RECOVERY_DATA = ")
            .strip()
            .removesuffix(";")
        )

        def read(name):
            with (data / name).open() as f:
                rows = list(csv.DictReader(f))
            # Indexing duplicate rows into a dictionary would otherwise hide them.
            keys = [
                (r["patient_id"], r.get("wake_date", r.get("morning_date")))
                for r in rows
            ]
            if len(keys) != len(set(keys)):
                raise AssertionError(f"Duplicate patient or patient-day in {name}")
            return rows

        cls.sleep = {
            (r["patient_id"], r["wake_date"]): r for r in read("sleep_nights.csv")
        }
        cls.diaries = {
            (r["patient_id"], r["morning_date"]): r["help_getting_dressed"]
            for r in read("dressing_diary.csv")
        }
        cls.inventory = {
            r["patient_id"]: r["baseline_sleep_group"] for r in read("patients.csv")
        }

    def test_all_files_reconcile_to_raw_intervals(self):
        patients = self.payload["patients"]
        self.assertEqual(len(self.inventory), 48)
        self.assertEqual(len(patients), 48)
        self.assertEqual(len(self.sleep), 48 * 56)
        self.assertEqual(set(self.sleep), set(self.diaries))
        for p in patients:
            with ZipFile(ROOT / "data" / "apple_health" / (p["id"] + ".zip")) as z:
                raw = sleep_nights(z.read("apple_health_export/export.xml"), TZ)
            self.assertEqual(len(p["days"]), 56)
            self.assertEqual(p["group"], self.inventory[p["id"]])
            self.assertEqual(p["group"], classify([d["night"] for d in p["days"][:7]]))
            self.assertEqual(sorted(raw), [d["date"] for d in p["days"] if d["night"]])
            for day in p["days"]:
                key = p["id"], day["date"]
                n = day["night"]
                self.assertEqual(day["help"] or "", self.diaries[key])
                self.assertEqual(raw.get(day["date"]), n)
                self.assertEqual(
                    self.sleep[key]["recording"], "recorded" if n else "missing"
                )
                for col, field in (
                    ("asleep_min", "sleep"),
                    ("awake_min", "awake"),
                    ("interruptions", "bouts"),
                ):
                    self.assertEqual(self.sleep[key][col], str(n[field]) if n else "")

    def test_expected_synthetic_pattern_and_exceptions(self):
        patients = self.payload["patients"]

        def rate(p, w):
            reports = [d["help"] for d in p["days"][7 * w : 7 * w + 7] if d["help"]]
            return sum(s == "independent" for s in reports) / len(reports)

        gains = []
        for g in ("fewer", "intermediate", "frequent"):
            members = [p for p in patients if p["group"] == g]
            self.assertEqual(len(members), 16)
            gains.append(sum(rate(p, 7) - rate(p, 0) for p in members) / len(members))
        self.assertGreater(gains[0], gains[1])
        self.assertGreater(gains[1], gains[2])
        self.assertTrue(
            any(rate(p, 7) <= rate(p, 0) for p in patients if p["group"] == "fewer")
        )
        self.assertTrue(
            any(rate(p, 7) > rate(p, 0) for p in patients if p["group"] == "frequent")
        )
        self.assertTrue(
            any(d["help"] is None and d["night"] for p in patients for d in p["days"])
        )
        self.assertTrue(
            any(d["help"] and d["night"] is None for p in patients for d in p["days"])
        )
