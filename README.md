# Sleep & Stroke Recovery Explorer

**[Open the interactive dashboard](https://angelinasverchkova.github.io/sleep-recovery-explorer/)**

Explore how sleep interruptions and the ability to get dressed without help change over eight weeks after stroke. All 48 patients are fictional. The simulation intentionally gives the groups different average recovery patterns.

To try it, select **Frequent** in **Compare sleep groups**. The heatmap narrows to the 16 patients whose watch recorded at least five awakenings per night on average in week 1. Open **P012, Week 8**. The cell reads **0%**. The diary shows why: the patient needed help on all six reported mornings and left one morning unanswered.

[![Dashboard preview showing sleep group trends above a blue heatmap with one row per patient](docs/dashboard-preview.png)](https://angelinasverchkova.github.io/sleep-recovery-explorer/)

## Explore the dashboard

The live dashboard opens in a browser on desktop or mobile. For an offline copy, choose **Code → Download ZIP** on GitHub, unzip the whole project and open **index.html**.

1. **Compare sleep groups** opens with all 48 patients. Three lines track groups defined by average awakenings in week 1. The fourth line gives the overall average. Select a point or a group to filter the heatmap. Use the time span controls to focus on particular weeks.
2. **Patient heatmap** shows one patient per row and one week per column. The number is the percentage of reported mornings dressed without help. Darker blues indicate more awakenings, more help needed, or both, on days with both records. Weeks start in calendar order. The axis order menu also lets you group similar weeks or sort patients by ID.
3. **Patients** shows one person's weekly dressing reports and average awakenings. Opening a heatmap cell takes you to that exact patient and week. In the seven-day morning diary, select a date to see the preceding night’s estimated stages on a clock marked in CET (UTC+1). The link beside the trace downloads that patient's generated sleep XML in a ZIP. [Mobile diary preview](docs/patient-diary-mobile.png)
4. **About the data** explains the study and the simulation. The full [methods and sources](docs/methods.md) include the calculations and missing-data rules.

On a weekly chart, the left and right arrow keys move between weeks. Home and End select the first and last visible weeks. In the heatmap, use the arrow keys to move between cells and Enter to open a diary.

### Try a fictional diary note

Under **Patients → Morning diary**, select **Review diary with AI**, type a fictional English note or choose **Try an example**, then select **Analyse note**. To start with an existing example, open P012 in week 8 and select 29 November. The text classifier suggests the level of dressing support and quotes the sentence it used. Editing the note clears the suggestion. This practice tool runs entirely in the browser, including from an unzipped copy of the dashboard. Notes stay in memory and suggestions do not change the charts.

The classifier compares word and word-pair patterns with a small labelled collection of fictional examples using TF-IDF and nearest neighbours. It can return **Support unclear** for unfamiliar wording. Word overlap can also give a misleading match, particularly with negation, multiple activities or complex timelines. Review the source sentence before interpreting a suggestion. The examples and regression tests illustrate behaviour on synthetic text; accuracy on patient narratives has not been evaluated.

## Study and demonstration

Yang and colleagues followed 306 stroke survivors and found an association between longitudinal sleep patterns and disability at 12 months. The authors used ActiGraph accelerometry and the modified Rankin Scale. This project uses Apple Health–style simulated intervals and an eight-week dressing diary. The data illustrate the analytical workflow and cannot estimate an effect in real patients. [Original study](https://pubmed.ncbi.nlm.nih.gov/41652308/) · [Methods and sources](docs/methods.md)

## Project map

| Location | Contents |
| --- | --- |
| `index.html` | Offline dashboard entry point, controls and study notes |
| `assets/model.js` | Weekly summaries and group comparison rules |
| `assets/charts.js` | Responsive SVG figures |
| `assets/profiles.js` | Paired weekly observations and average-linkage clustering |
| `assets/matrix.js` | Interactive patient-by-week heatmap, branching diagrams and keyboard navigation |
| `assets/app.js` | Patient selection, linked time window, group selection and night inspection |
| `assets/style.css` | Layout, typography and colour system |
| `pipeline/generate.py` | Seeded simulation, synthetic Apple exports and data build |
| `pipeline/health.py` | Stage parsing, session validation and overnight measures |
| `data/apple_health/` | 48 ZIPs, each containing `apple_health_export/export.xml` for one fictional patient |
| `data/*.csv` | Patient groups, sleep summaries and separate morning diaries |
| `data/dashboard.js` | Browser-ready copy of the parsed data for opening via `file://` |
| `docs/methods.md` | Evidence, assumptions, data dictionary and interpretation |
| `tests/` | Pipeline, generated-data, analytical and browser tests |

## Reproduce and test

Run commands from the project directory. Python 3.9+ with the IANA time zone database and Node.js 20+ are needed for development. The generator and analytical tests use their language's standard library.

On Windows, if Python cannot find the `Europe/Oslo` time zone, run `py -m pip install tzdata` in the Python environment you use for this project. Use `py` in place of `python3` in the commands below.

```sh
python3 -m pipeline.generate
python3 -m unittest discover -s tests -p "test_*.py" -v
node --test tests/*.test.cjs
```

To generate independently in another directory, pass `--output PATH`. The same seed, generator and Python runtime produce the same cohort. Generated files are staged before replacement. The browser reads one bundle, replaced last, so it always sees a complete dataset.

For optional end-to-end tests, install the pinned test driver and a Chromium browser. The dashboard itself has no package dependencies.

```sh
npm ci
npx playwright-core install chromium
npm run test:browser
```

Set `CHROME_BIN` to test with an already installed Chrome executable. On macOS one common location is `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`. Set `QA_DIR` to save desktop and phone screenshots during the browser test. The suite checks direct opening from disk, no network requests, filtering, range selection, missing data, the methods dialog and responsive layouts.
