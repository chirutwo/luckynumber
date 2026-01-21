// The thing
const reader = document.getElementById("reader");
const title = document.getElementById("title");
const button = document.getElementById("button");

let reroll = 0;

function findLuckyNumber() {
	let lucky = (Math.round(Math.random() * 10000)).toString();
	reader.innerText = "Your lucky number is: "+lucky;
	title.innerText = lucky+" is your Lucky Number";
	console.log(lucky);

	reroll += 1;
	if (reroll > 0) {
		button.innerText = "Regenerate Lucky Number (done "+reroll+" times)";
	}
}

button.addEventListener("click", findLuckyNumber);
//findLuckyNumber();
