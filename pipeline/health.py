"""Read the documented sleep-category subset of an Apple Health XML export."""

from datetime import datetime
import xml.etree.ElementTree as ET

KIND = "HKCategoryTypeIdentifierSleepAnalysis"
PREFIX = "HKCategoryValueSleepAnalysis"
STAGES = {
    "AsleepCore": "C",
    "AsleepREM": "R",
    "AsleepDeep": "D",
    "Awake": "W",
    "AsleepUnspecified": "U",
}
STAMP = "%Y-%m-%d %H:%M:%S %z"


def sleep_nights(xml, tz):
    """Map local wake date to a start timestamp and contiguous [stage, minutes] runs.

    Exports for this project have one stage source, one main night per day and
    minute-aligned samples. Reject overlaps, ambiguous sources and within-night gaps.
    """
    intervals = []
    sources = set()
    for rec in ET.fromstring(xml).iter("Record"):
        if rec.get("type") != KIND:
            continue
        value = rec.attrib["value"]
        if value == PREFIX + "InBed":
            continue
        if not value.startswith(PREFIX) or value[len(PREFIX) :] not in STAGES:
            raise ValueError(f"Unknown sleep stage {value}")
        sources.add(rec.attrib["sourceName"])
        a, b = (
            int(datetime.strptime(rec.attrib[key], STAMP).timestamp())
            for key in ("startDate", "endDate")
        )
        if b <= a or a % 60 or b % 60:
            raise ValueError("Expected positive intervals aligned to whole minutes")
        intervals.append((a, b, STAGES[value[len(PREFIX) :]]))
    if len(sources) > 1:
        raise ValueError("Multiple stage sources require reconciliation")
    sessions = []
    last_end = None
    for a, b, stage in sorted(intervals):
        if last_end is None or a - last_end >= 6 * 3600:
            sessions.append([a, []])
        elif a != last_end:
            raise ValueError("Gap or overlap within a sleep session")
        runs = sessions[-1][1]
        minutes = (b - a) // 60
        if runs and runs[-1][0] == stage:
            runs[-1][1] += minutes
        else:
            runs.append([stage, minutes])
        last_end = b
    nights = {}
    for start, runs in sessions:
        if runs[0][0] == "W" or runs[-1][0] == "W":
            raise ValueError("Watch-only records must start and end with sleep")
        duration = sum(length for _, length in runs)
        wake_date = datetime.fromtimestamp(start + 60 * duration, tz).date().isoformat()
        if wake_date in nights:
            raise ValueError("Expected one overnight session per wake date")
        nights[wake_date] = {
            "start": start,
            "runs": runs,
            "sleep": sum(length for stage, length in runs if stage != "W"),
            "awake": sum(length for stage, length in runs if stage == "W"),
            "bouts": sum(stage == "W" for stage, _ in runs),
        }
    return nights
