"""Build all example data from a fixed seed. Run from project root with python3 -m pipeline.generate."""

import argparse
import csv
from datetime import date, datetime, time, timedelta, timezone
import json
from pathlib import Path
import random
from tempfile import TemporaryDirectory
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo
from zoneinfo import ZoneInfo
import xml.etree.ElementTree as ET

from .health import KIND, PREFIX, STAGES, STAMP, sleep_nights

ROOT = Path(__file__).resolve().parents[1]
TZ = ZoneInfo("Europe/Oslo")
DAY_ONE = date(2026, 10, 5)
SEED = 41503
PATIENTS = 48
WEEKS = 8
APP_CODES = {value: key for key, value in STAGES.items()}
HELP = ("independent", "prompting", "hands_on")
GROUPS = ("fewer", "intermediate", "frequent")


def partition(total, weights):
    """Integer allocation by cumulative rounding keeps the exact total."""
    scale = total / sum(weights)
    previous = running = 0
    parts = []
    for weight in weights:
        running += weight
        boundary = round(running * scale)
        parts.append(boundary - previous)
        previous = boundary
    return parts


def simulate_stages(rng, asleep, interruptions):
    cycles = rng.choice((4, 5, 5, 5, 6))
    minutes = []
    for cycle, length in enumerate(
        partition(asleep, [rng.uniform(0.8, 1.2) for _ in range(cycles)])
    ):
        phase = cycle / (cycles - 1)
        weights = [
            0.27,
            max(0.012, 0.31 * (1 - phase)) * rng.uniform(0.75, 1.25),
            0.23,
            (0.10 + 0.22 * phase) * rng.uniform(0.8, 1.2),
        ]
        for stage, duration in zip("CDCR", partition(length, weights)):
            minutes.extend([stage] * duration)
    for pos in sorted(rng.sample(range(3, asleep - 3), interruptions), reverse=True):
        minutes[pos:pos] = ["W"] * rng.randint(3, 14)
    runs = []
    for stage in minutes:
        if runs and runs[-1][0] == stage:
            runs[-1][1] += 1
        else:
            runs.append([stage, 1])
    return runs


def xml_export(nights, patient_id):
    root = ET.Element("HealthData", locale="en_NO")
    ET.SubElement(root, "ExportDate", value="2026-12-01 12:00:00 +0100")
    ET.SubElement(root, "Me")
    source = f"Simulated Apple Watch {patient_id}"
    for wake_day, onset_minutes, runs in nights:
        local_evening = datetime.combine(wake_day - timedelta(days=1), time(21), TZ)
        clock = local_evening.astimezone(timezone.utc) + timedelta(
            minutes=onset_minutes
        )
        creation = clock + timedelta(minutes=sum(m for _, m in runs) + 4)
        for stage, minutes in runs:
            end = clock + timedelta(minutes=minutes)
            ET.SubElement(
                root,
                "Record",
                type=KIND,
                sourceName=source,
                sourceVersion="11.0",
                creationDate=creation.astimezone(TZ).strftime(STAMP),
                startDate=clock.astimezone(TZ).strftime(STAMP),
                endDate=end.astimezone(TZ).strftime(STAMP),
                value=PREFIX + APP_CODES[stage],
            )
            clock = end
    return ET.tostring(root, encoding="utf-8", xml_declaration=True)


def simulate_patient(i):
    """Separate seeded streams for wearable and diary, with shared profile-level drift."""
    sleep = random.Random(SEED + i * 251)
    diary = random.Random(SEED * 7 + i * 277)
    profile = i % 3
    pid = f"P{i + 1:03d}"
    baseline_days = 1 + (i // 3) % 3
    slope = (3.6, 2.2, 0.7)[profile] + diary.gauss(0, 1)
    if i // 3 in (4, 11):  # Some individual trajectories go against the cohort trend.
        slope += (-3, 0, 3)[profile]
    preferred_duration = sleep.randint(458, 512)
    nights, mornings = [], []
    for week in range(WEEKS):
        fraction = week / (WEEKS - 1)
        count = max(
            0,
            min(
                7,
                round(
                    baseline_days
                    + slope * fraction
                    + (diary.gauss(0, 0.68) if week else 0)
                ),
            ),
        )
        statuses = [HELP[0]] * count + [
            diary.choice(HELP[1:]) for _ in range(7 - count)
        ]
        diary.shuffle(statuses)
        missed_diary = diary.randrange(7) if week and diary.random() < 0.15 else -1
        missed_watch = sleep.randrange(7) if sleep.random() < 0.28 else -1
        for day in range(7):
            wake_day = DAY_ONE + timedelta(days=week * 7 + day)
            mornings.append(
                (wake_day.isoformat(), None if day == missed_diary else statuses[day])
            )
            if day == missed_watch:
                continue
            if week == 0:
                bouts = sleep.choice(((0, 1, 2), (3, 4), (5, 6, 7))[profile])
            else:
                bouts = max(
                    0, min(10, round(sleep.gauss((1.5, 3.6, 5.9)[profile], 1.15)))
                )
            duration = round(sleep.gauss(preferred_duration, 23))
            runs = simulate_stages(sleep, max(365, min(570, duration)), bouts)
            nights.append((wake_day, sleep.randint(48, 145), runs))
    return pid, nights, mornings


def classify(first_week):
    worn = [night for night in first_week if night is not None]
    if len(worn) < 4:
        return "unclassified"
    mean = sum(n["bouts"] for n in worn) / len(worn)
    return GROUPS[0] if mean <= 2 else GROUPS[1] if mean < 5 else GROUPS[2]


def write_csv(path, header, rows):
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle, lineterminator="\n")
        writer.writerow(header)
        writer.writerows(rows)


def write_zip(path, xml):
    info = ZipInfo("apple_health_export/export.xml", (2026, 12, 1, 12, 0, 0))
    info.compress_type = ZIP_DEFLATED
    with ZipFile(path, "w") as archive:
        archive.writestr(info, xml)


def build(target):
    target = Path(target)
    target.mkdir(parents=True, exist_ok=True)
    with TemporaryDirectory(dir=target) as temp:
        stage = Path(temp)
        raw = stage / "apple_health"
        raw.mkdir()
        patients, summary, diaries = [], [], []
        for i in range(PATIENTS):
            pid, nights, reports = simulate_patient(i)
            xml = xml_export(nights, pid)
            write_zip(raw / f"{pid}.zip", xml)
            parsed = sleep_nights(xml, TZ)
            group = classify([parsed.get(day) for day, _ in reports[:7]])
            days = []
            for date_text, status in reports:
                obs = parsed.get(date_text)
                summary.append(
                    [
                        pid,
                        date_text,
                        "recorded" if obs else "missing",
                        *(
                            [obs["sleep"], obs["awake"], obs["bouts"]]
                            if obs
                            else [None] * 3
                        ),
                    ]
                )
                diaries.append([pid, date_text, status])
                days.append({"date": date_text, "help": status, "night": obs})
            patients.append({"id": pid, "group": group, "days": days})
        write_csv(
            stage / "patients.csv",
            ["patient_id", "baseline_sleep_group"],
            [(p["id"], p["group"]) for p in patients],
        )
        write_csv(
            stage / "sleep_nights.csv",
            [
                "patient_id",
                "wake_date",
                "recording",
                "asleep_min",
                "awake_min",
                "interruptions",
            ],
            summary,
        )
        write_csv(
            stage / "dressing_diary.csv",
            ["patient_id", "morning_date", "help_getting_dressed"],
            diaries,
        )
        dataset = {
            "version": 1,
            "synthetic": True,
            "timezone": "Europe/Oslo",
            "weeks": WEEKS,
            "patients": patients,
        }
        bundle = stage / "dashboard.js"
        bundle.write_text(
            "window.SLEEP_RECOVERY_DATA = "
            + json.dumps(dataset, separators=(",", ":"))
            + ";\n",
            encoding="utf-8",
        )
        # Publish only our named artifacts. The browser bundle is replaced last.
        for item in sorted(
            [p for p in stage.rglob("*") if p.is_file()], key=lambda p: p == bundle
        ):
            dest = target / item.relative_to(stage)
            dest.parent.mkdir(parents=True, exist_ok=True)
            item.replace(dest)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=ROOT / "data")
    build(parser.parse_args().output)
