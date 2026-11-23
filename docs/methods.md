# Study, simulation and data dictionary

## The clinical question

Can two stroke survivors sleep for similar lengths of time but have different patterns of uninterrupted sleep and everyday recovery? The dashboard pairs estimated sleep continuity with an easy-to-understand daily observation: whether a person got dressed independently, with prompting or with hands-on help.

### What the source supports

Fan-Jiayi Yang and colleagues recruited 362 people after stroke at five tertiary hospitals in China; 306 completed follow-up. Researchers used ActiGraph GT3X accelerometers across three recovery phases. They identified four sleep trajectories and measured disability at 12 months with the modified Rankin Scale.

The subgroup with relatively long sleep, worsening fragmentation and lower sleep efficiency comprised about 24 participants (7.84%). Compared with the consistently good-sleep group, its estimated odds of a poor functional outcome were 5.73 times as high (95% confidence interval 2.12–15.44). This observational result applies to the combination of features. It does not isolate duration, identify a causal mechanism, or provide a personal forecast. [Yang et al., *Neurorehabilitation and Neural Repair*, 2026](https://pubmed.ncbi.nlm.nih.gov/41652308/) · [Journal article](https://doi.org/10.1177/15459683261416417)

### What the project adds

The study did not measure Apple Watch sleep stages, independent dressing over eight weeks or the cutoffs below. Its four longitudinal groups and this demo's three baseline groups have different definitions. The REM, core and deep stages provide a realistic device-data interface. We do not infer neurological recovery from stage proportions.

For the default data, the starting cohort means are approximately 28% of reported mornings dressed without help in each group. By week 8 the means are approximately 66% (few interruptions), 58% (moderate) and 42% (frequent). Those values describe the artificial scenario. They are neither fitted to the publication nor evidence of a treatment effect. Some individuals improve despite frequent interruptions and some show little progress despite relatively continuous sleep.

## From device records to the dashboard

1. Generate a main overnight episode and a separately seeded morning diary for each patient-day. The 48 fictional IDs run from P001 to P048. The 56 morning dates extend from 5 October through 29 November 2026. All calendar dates and device details are fictional.
2. Write each patient's records to their own zipped Apple Health–style XML export. Each `Record` has the sleep-analysis type, category, source name and version, creation date and offset-aware start/end dates. No real device identifiers or personal data are used.
3. Read back the same XML. Measure elapsed durations from timestamps in absolute time, group by local wake date in Europe/Oslo, and join to the diary by patient ID and morning date. This handles midnight and the autumn clock change.
4. Write CSV outputs and the browser bundle. Browser aggregation starts from the parsed nightly values. Changing the time span changes what is visible; it never reclassifies baseline sleep groups.

### Apple Health representation

Apple describes a category sample for each continuous interval of a stage. The exporter here writes four detailed values under `HKCategoryTypeIdentifierSleepAnalysis`: `HKCategoryValueSleepAnalysisAwake`, `HKCategoryValueSleepAnalysisAsleepCore`, `HKCategoryValueSleepAnalysisAsleepDeep` and `HKCategoryValueSleepAnalysisAsleepREM`. The parser also supports `AsleepUnspecified`. Apple Watch awake intervals occur between sleep samples. Optional in-bed intervals can overlap the detailed samples. [Apple HealthKit category reference](https://developer.apple.com/documentation/healthkit/hkcategoryvaluesleepanalysis?language=objc) · [Apple’s WWDC explanation](https://developer.apple.com/videos/play/wwdc2022/10005/?time=658)

Our watch-only simulations omit in-bed intervals. The parser ignores them if present to avoid double counting. Unrecorded leading and trailing time is unknown, so the dashboard does not report time in bed or clinical sleep efficiency. Apple describes a user-facing XML export; the project mirrors the sleep-record fields rather than promising general compatibility with every Apple export. [Apple Health export instructions](https://support.apple.com/guide/iphone/share-your-health-data-iph5ede58c3d/ios) · [Example of the export schema](https://github.com/artxgj/apple_health)

Simulated records use minute boundaries, one source and one main overnight session. There are no naps, competing device sources or minute-level contact losses. The generator builds four to six synthetic cycles, allocating more deep sleep earlier and more REM later, and inserts awake intervals of varying duration. These are modelling choices. Actual Apple stages are algorithmic estimates. [Apple’s sleep-stage validation paper](https://www.apple.com/health/pdf/Estimating_Sleep_Stages_from_Apple_Watch_Oct_2025.pdf)

### Example XML record

```xml
<Record type="HKCategoryTypeIdentifierSleepAnalysis"
        sourceName="Simulated Apple Watch P001"
        sourceVersion="11.0"
        creationDate="2026-10-05 07:04:00 +0200"
        startDate="2026-10-05 02:15:00 +0200"
        endDate="2026-10-05 02:30:00 +0200"
        value="HKCategoryValueSleepAnalysisAsleepREM" />
```

This illustrates the structure. Unzip any file in `data/apple_health/` to inspect the exact records used by the page.

## Measures and denominators

| Measure | Definition |
| --- | --- |
| Estimated time asleep | Sum of recorded core, deep, REM and unspecified sleep interval durations, in minutes |
| Awake minutes | Sum of recorded awake intervals after initial sleep and before final waking |
| Sleep interruptions | Number of contiguous runs of awake samples between sleep stages. Adjacent awake samples count once |
| Week 1 sleep group | Average interruptions per recorded night in the first seven days. Few is ≤2; moderate is >2 and <5; frequent is ≥5. At least four recorded nights are needed. These are illustrative thresholds |
| Patient's weekly independence | 100 × independent mornings / completed dressing reports that week. Both prompting and hands-on help count as needing help |
| Cohort line in each week | Arithmetic mean of available individual percentages in the fixed baseline group. Each patient has equal weight. It can differ from pooling all diary entries |
| Night selection | The evening leading into the selected local morning, paired with that morning’s diary entry. Week numbers count from the first day of synthetic observation |

### Reading a heatmap cell

Each patient-week has two summaries. The printed percentage uses every completed dressing report. The blue shade uses only mornings with both a watch recording and a diary entry. For these paired mornings, calculate the mean number of awakenings and the fraction of mornings needing any help. Divide the mean awakenings by the largest nightly awakening count across all paired records in the dataset (at least one for scaling). Average the two quantities with equal weights and map the result to seven blue shades. The same scale applies across patients, filters and weeks. Grey marks a week without a pair, and a dash marks a week without a diary entry. The colour is a visual summary chosen for this simulation.

The default order groups patients with similar profiles and keeps weeks chronological. Distances use the root mean square difference on the two scaled measures across weeks where both patients have paired observations. Average-linkage clustering combines groups using the mean of available pairwise distances. Records with no comparable observations remain separate. The optional clustered-week view applies the same procedure across patients. Sorting by patient ID restores a simple lookup table. These display choices do not alter week 1 sleep group membership.

The night chart and recording times use fixed CET (UTC+1) so the clock advances uniformly even across the autumn clock change. The XML retains the offset used in Oslo at the time of each observation, including summer time (UTC+2). Morning dates follow the original Oslo calendar.

### Missingness and variation

The generator may omit a whole watch night and may separately omit a morning report. In the delivered data, 103 of 2,688 patient-nights have no recording and 54 morning reports are missing. Missing records lower only the relevant denominator. A week with no diary reports has no independence estimate. A night with zero interruptions has a valid sleep record and differs from a missing night. Percentages in early and late weeks can be noisy because there are at most seven morning reports.

Sleep and recovery use separate pseudorandom streams. They share an assigned baseline sleep profile through an intentionally different average recovery slope. Baseline independence is balanced across the three groups. Patient-level variability and exceptions are retained. Only baseline interruptions define the strata; dressing responses never enter that classification. The simulation omits clinical covariates such as severity, medication and depression. It is a descriptive portfolio demonstration.

## Generated files

| File | Grain and fields |
| --- | --- |
| `patients.csv` | One row per patient, with `patient_id` and derived `baseline_sleep_group` |
| `sleep_nights.csv` | One row per patient per local morning; `wake_date`, `recording`, `asleep_min`, `awake_min`, `interruptions`. Empty measurements mean there was no recording |
| `dressing_diary.csv` | One row per patient per morning; `morning_date` and `help_getting_dressed` with `independent`, `prompting`, `hands_on`, or blank for an unanswered diary |
| `apple_health/Pnnn.zip` | Sleep-only sample export for that patient under `apple_health_export/export.xml` |
| `dashboard.js` | Versioned browser payload, including local date, diary value, period start in Unix seconds, stage/minute runs, asleep/awake minutes and interruption count |

## Scope of the parser

The XML reader is intended for the simulation’s documented single-source, whole-minute subset. It sorts records, merges adjacent identical stages, handles omitted in-bed records and checks for positive duration, unexpected stage codes, overlaps, short internal gaps, duplicate wake dates and conflicting stage sources. A gap of six hours or more starts a new session. Using arbitrary personal exports would require a separate, consent-based ingestion design and reconciliation rules for overlapping devices, naps and irregular sampling.

## Verification

Python tests reconcile every exported patient-night to its raw XML, both CSVs and the browser bundle. Other tests check reproducibility, clock changes, input validation and the designed cohort pattern. JavaScript tests verify denominators and window rules. The Chromium smoke suite opens `index.html` directly and exercises both figures, date selection, group filtering, missing nights, the study dialog and responsive layouts. See the [project README](../README.md) for commands.
