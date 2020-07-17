const History = require("./src/history");
const hist = new History().get();

const UPPERMIN = 93;
const EXCLUDE = [76];

let longest = 0;
let longval = 0;
console.log("Total entries: " + hist.length);
for (i in hist) {
	if (hist[i] != null) {
		let min = 100,
			max = 0;
		for (x of hist[i].curve) {
			if (x.soc < min && x.soc > 0) {
				min = x.soc;
			}
			if (x.soc > max && x.soc >= UPPERMIN) {
				max = x.soc;
			}
		}
		let delta = Math.max(0, max - min);
		//console.log(delta, longval);

		if (delta >= longval && !EXCLUDE.includes(i)) {
			longest = i;
			longval = delta;
		}
	}
}
console.log("Longest entry index: " + longest + " of length: " + longval);

//console.log(hist[longest]);

const createCsvWriter = require("csv-writer").createObjectCsvWriter;
const csvWriter = createCsvWriter({
	path: "exported.csv",
	header: [
		{ id: "date", title: "date" },
		{ id: "soc", title: "soc" },
		{ id: "power", title: "power" },
	],
});

/*const data = [
	{
		name: "John",
		surname: "Snow",
		age: 26,
		gender: "M",
	},
	{
		name: "Clair",
		surname: "White",
		age: 33,
		gender: "F",
	},
	{
		name: "Fancy",
		surname: "Brown",
		age: 78,
		gender: "F",
	},
];*/

csvWriter
	.writeRecords(hist[longest].curve)
	.then(() => console.log("The CSV file was written successfully"));
