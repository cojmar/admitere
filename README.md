# Admitere Bucuresti - Top Licee

An open-source project that parses and presents public information about top high schools (liceu) in Bucharest, Romania, in a human-friendly format for parents.

**All data is publicly available and sourced exclusively from:** [bacplus.ro/top-licee/bucuresti](https://www.bacplus.ro/top-licee/bucuresti)

**Live Preview:** [cojmar.github.io/admitere](https://cojmar.github.io/admitere/)

## About

This project scrapes publicly available school ranking data from bacplus.ro and presents it in a clean, searchable, and filterable interface. The goal is to make it easier for parents to compare high schools based on admission scores, graduation rates, number of applicants, and program specializations.

The data includes:
- School rankings and names
- Baccalaureate averages (`medieBac`)
- Admission averages (`medieAdm`)
- Graduation rates (`rataPromovare`)
- Number of applicants (`numCandidati`)
- Program groups and specializations with their respective admission scores and available seats

## How it works

### Data Generation (`generate.js`)

`generate.js` is a Node.js script that:

1. Fetches the main rankings page from `https://www.bacplus.ro/top-licee/bucuresti`
2. Parses the HTML table to extract school names, ranks, averages, graduation rates, and applicant counts
3. For each school, fetches its individual page to extract detailed profile information (program groups, specializations, admission scores per track, available seats)
4. Processes schools concurrently (3 at a time) for efficiency
5. Saves all collected data to `data.json` with a generation timestamp
6. Optionally auto-commits and pushes the updated `data.json` to the repository via Git

**To run:**

```bash
node generate.js
```

This will fetch the latest data and generate/overwrite `data.json`.

### Display (`index.html`)

`index.html` is a standalone, single-file web application that:

- Loads `data.json` from the same directory
- Renders a sortable table with all school rankings
- Provides real-time search by school name
- Allows filtering by admission score threshold
- Allows filtering by program/specialization
- Highlights admission scores by color (green for >= 9.0, yellow for 8.0-8.99, red for < 8.0)
- Persists user filter preferences in `localStorage`
- Fully responsive, works on mobile and desktop

No server or build step is required — just serve the files from any static host.

## License

This project is distributed under the **GNU General Public License v3.0 (GPL-3.0)**. You are free to use, modify, and distribute this project in accordance with the license terms.

## Disclaimer

**We do not assume any responsibility for the accuracy, completeness, or fitness for purpose of the data collected from the source website.** The data is sourced from a third-party public website and is provided "as is" without any warranties. Users should verify all information independently before making any decisions based on this data. We are not responsible for any consequences arising from the use or misuse of this website or its data.
