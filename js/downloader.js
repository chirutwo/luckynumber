function setError(err) {
	console.error(err);
}

function isScratch1(arr) {
	const start = 'ScratchV';
	for (let i = 0; i < start.length; i++) {
		if (arr[i] !== start.charCodeAt(i)) {
			return false;
		}
	}
	return true;
}

function isZip(arr) {
	return (arr[0] === 0x50) && (arr[1] === 0x4b);
}

async function decodeScratch1Project(arr) {
	//Convert to sb2 and interpret
	const file = new SB1File(arr.buffer);
	const json = file.json;
	const files = file.zip.files;
	//console.log(files);

	for (let i = 0; i < json.costumes.length; i++) {
		json.costumes[i].fileFormat = json.costumes[i].baseLayerMD5.slice(json.costumes[i].baseLayerMD5.indexOf(".")+1);
		json.costumes[i].data = files[json.costumes[i].baseLayerID + "." + json.costumes[i].fileFormat].bytes;
	}
	for (let i = 0; i < json.sounds.length; i++) {
		json.sounds[i].fileFormat = json.sounds[i].md5.slice(json.sounds[i].md5.indexOf(".")+1);
		json.sounds[i].data = files[json.sounds[i].soundID + "." + json.sounds[i].fileFormat].bytes;
	}
	for (let i = 0; i < json.children.length; i++) {
		let target = json.children[i];
		for (let j = 0; j < target.costumes.length; j++) {
			target.costumes[j].fileFormat = target.costumes[j].baseLayerMD5.slice(target.costumes[j].baseLayerMD5.indexOf(".")+1);
			target.costumes[j].data = files[target.costumes[j].baseLayerID + "." + target.costumes[j].fileFormat].bytes;
		}
		for (let j = 0; j < target.sounds.length; j++) {
			target.sounds[j].fileFormat = target.sounds[j].md5.slice(target.sounds[j].md5.indexOf(".")+1);
			target.sounds[j].data = files[target.sounds[j].soundID + "." + target.sounds[j].fileFormat].bytes;
		}
	}
	return {version: 2, objs: json};
}

function findFile(files, filename) {
	for (let i = 0; i < files.length; i++) {
		if (files[i].filename === filename) {
			return files[i];
		}
	}
	return null;
}

async function decodeScratch2or3Project(arr) {
	if (isZip(arr)) {
		const reader = new zip.ZipReader(new zip.Uint8ArrayReader(arr));
		const entries = await reader.getEntries();

		let files = [];
		let obj = {};

		if (entries.length) {
			let data = null;
			for (const i in entries) {
				if (entries[i].filename.slice(-4) === "json") {
					data = await entries[i].getData(new zip.TextWriter());
					obj = await JSON.parse(data);
				} else {
					data = await entries[i].getData(new zip.Uint8ArrayWriter());
					files.push({
						filename: entries[i].filename,
						data: data,
						format: entries[i].filename.slice(entries[i].filename.lastIndexOf(".")+1)
					});
				}
			}
		}

		let version = 3;
		if (typeof obj.objName === 'undefined') {
			//Scratch 3
			let numAssets = 0;
			let loadedAssets = 0;

			//Count assets
			for (let i = 0; i < obj.targets.length; i++) {
				if (typeof obj.targets[i].sounds !== 'undefined') {
					numAssets += obj.targets[i].sounds.length;
				}
				if (typeof obj.targets[i].costumes !== 'undefined') {
					numAssets += obj.targets[i].costumes.length;
				}
			}

			//Find data
			for (let i = 0; i < obj.targets.length; i++) {
				if (typeof obj.targets[i].sounds !== 'undefined') {
					for (let j = 0; j < obj.targets[i].sounds.length; j++) {
						let sound = obj.targets[i].sounds[j];
						let file = findFile(files, sound.md5ext);
						let data = null;

						if (file === null) {
							data = await downloadAsset(sound.md5ext);
						} else {
							data = file.data;
						}

						if (data === null) {
							setError(`Could not find file associated with the sound ${sound.name}.`);
						}

						obj.targets[i].sounds[j].data = data;
						loadedAssets++;
					}
				}
				if (typeof obj.targets[i].costumes !== 'undefined') {
					for (let j = 0; j < obj.targets[i].costumes.length; j++) {
						let costume = obj.targets[i].costumes[j];
						let file = findFile(files, costume.md5ext);
						let data = null;

						if (file === null) {
							data = await downloadAsset(costume.md5ext);
						} else {
							data = file.data;
						}

						if (data === null) {
							setError(`Could not find file associated with the costume ${costume.name}.`);
						}

						obj.targets[i].costumes[j].data = data;
						loadedAssets++;
					}
				}
			}
		} else {
			//Scratch 2
			version = 2;

			let numAssets = 0;
			let loadedAssets = 0;

			//Count asssets
			if (typeof obj.sounds !== 'undefined') {
				numAssets += obj.sounds.length;
			}
			if (typeof obj.costumes !== 'undefined') {
				numAssets += obj.costumes.length;
			}
			if (typeof obj.children !== 'undefined') {
				for (let i = 0; i < obj.children.length; i++) {
					if (typeof obj.children[i].costumes !== 'undefined') {
						numAssets += obj.children[i].costumes.length;
					}
					if (typeof obj.children[i].sounds !== 'undefined') {
						numAssets += obj.children[i].sounds.length;
					}
				}
			}
			if (typeof obj.penLayerMD5 !== 'undefined') numAssets++;

			//Find data
			if (typeof obj.sounds !== 'undefined') {
				for (let i = 0; i < obj.sounds.length; i++) {
					let sound = obj.sounds[i];
					let file = findFile(files, sound.md5);
					let data = null;

					if (file === null) {
						data = await downloadAsset(sound.md5);
					} else {
						data = file.data;
					}

					if (data === null) {
						setError(`Could not find file associated with the sound ${sound.name}.`);
					}

					obj.sounds[i].data = data;
					loadedAssets++;
				}
			}
			if (typeof obj.costumes !== 'undefined') {
				for (let i = 0; i < obj.costumes.length; i++) {
					let costume = obj.costumes[i];
					let file = findFile(files, costume.baseLayerMD5);
					let data = null;

					if (file === null) {
						data = await downloadAsset(costume.baseLayerMD5);
					} else {
						data = file.data;
					}

					if (data === null) {
						setError(`Could not find file associated with the costume ${costume.name}.`);
					}

					obj.costumes[i].data = data;
					loadedAssets++;
				}
			}
			if (typeof obj.children !== 'undefined') {
				for (let i = 0; i < obj.children.length; i++) {
					if (typeof obj.children[i].costumes !== 'undefined') {
						for (let j = 0; j < obj.children[i].costumes.length; j++) {
							let costume = obj.children[i].costumes[j];
							let file = findFile(files, costume.baseLayerMD5);
							let data = null;

							if (file === null) {
								data = await downloadAsset(costume.baseLayerMD5);
							} else {
								data = file.data;
							}

							if (data === null) {
								setError(`Could not find file associated with the costume ${costume.name}.`);
							}

							obj.children[i].costumes[j].data = data;
							loadedAssets++;
						}
					}
					if (typeof obj.children[i].sounds !== 'undefined') {
						for (let j = 0; j < obj.children[i].sounds.length; j++) {
							let sound = obj.children[i].sounds[j];
							let file = findFile(files, sound.md5);
							let data = null;

							if (file === null) {
								data = await downloadAsset(sound.md5);
							} else {
								data = file.data;
							}

							if (data === null) {
								setError(`Could not find file associated with the sound ${sound.name}.`);
							}

							obj.children[i].sounds[j].data = data;
							loadedAssets++;
						}
					}
				}
			}
			if (typeof obj.penLayerMD5 !== 'undefined') {
				let file = findFile(files, obj.penLayerMD5);
				let data = null;

				if (file === null) {
					data = await downloadAsset(obj.penLayerMD5);
				} else {
					data = file.data;
				}

				if (data === null) {
					setError("Could not find Scratch 2 pen layer data.");
				}

				obj.penLayerData = data;
				loadedAssets++;
			}
		}

		return {version: version, objs: obj};
	} else {
		const decoder = new TextDecoder();
		const obj = JSON.parse(decoder.decode(arr));

		//console.log(obj);

		//Asset downloading
		let version = 3;
		if (typeof obj.objName === 'undefined') {
			//Scratch 3 project
			for (let i = 0; i < obj.targets.length; i++) {
				//console.log(obj.targets[i]);
				if (typeof obj.targets[i].sounds !== 'undefined') {
					for (let j = 0; j < obj.targets[i].sounds.length; j++) {
						obj.targets[i].sounds[j].data = new Uint8Array(await downloadAsset(obj.targets[i].sounds[j].md5ext));
					}
				}
				if (typeof obj.targets[i].costumes !== 'undefined') {
					for (let j = 0; j < obj.targets[i].costumes.length; j++) {
						obj.targets[i].costumes[j].data = new Uint8Array(await downloadAsset(obj.targets[i].costumes[j].md5ext));
					}
				}
			}
		} else {
			//Scratch 2 project
			version = 2;
			if (typeof obj.sounds !== 'undefined') {
				for (let i = 0; i < obj.sounds.length; i++) {
					obj.sounds[i].data = new Uint8Array(await downloadAsset(obj.sounds[i].md5));
				}
			}
			if (typeof obj.costumes !== 'undefined') {
				for (let i = 0; i < obj.costumes.length; i++) {
					obj.costumes[i].data = new Uint8Array(await downloadAsset(obj.costumes[i].baseLayerMD5));
				}
			}
			if (typeof obj.children !== 'undefined') {
				for (let i = 0; i < obj.children.length; i++) {
					if (typeof obj.children[i].costumes !== 'undefined') {
						for (let j = 0; j < obj.children[i].costumes.length; j++) {
							obj.children[i].costumes[j].data = new Uint8Array(await downloadAsset(obj.children[i].costumes[j].baseLayerMD5));
						}
					}
					if (typeof obj.children[i].sounds !== 'undefined') {
						for (let j = 0; j < obj.children[i].sounds.length; j++) {
							obj.children[i].sounds[j].data = new Uint8Array(await downloadAsset(obj.children[i].sounds[j].md5));
						}
					}
				}
			}
			if (typeof obj.penLayerMD5 !== 'undefined') {
				obj.penLayerData = new Uint8Array(await downloadAsset(obj.penLayerMD5));
			}
		}

		return {version: version, objs: obj};
	}
}

async function downloadScratch(id) {
	const response = await fetch(`https://trampoline.turbowarp.org/api/projects/${id}`);
	if (response.status === 404) {
		setError("The project is unshared or does not exist.");
	}
	if (!response.ok) {
		setError(`Error fetching project: ${response.status}`);
	}

	const json = await response.json();
	const token = await json.project_token;
	let url = `https://projects.scratch.mit.edu/${id}`;
	if (token) {
		url = `https://projects.scratch.mit.edu/${id}?token=${token}`;
	}
	const dataResponse = await fetch(url);
	if (!dataResponse.ok) {
		setError(`Error fetching project data: ${dataResponse.status}`);
	}
	const data = await dataResponse.arrayBuffer();
	return data;
}

async function downloadAsset(md5) {
	const response = await fetch(`https://assets.scratch.mit.edu/internalapi/asset/${md5}/get/`);
	if (response.status === 404) {
		setError(`Error fetching asset: the asset does not exist: ${md5}`);
		return null;
	}
	if (!response.ok) {
		setError(`Error fetching asset: ${md5}`);
		return null;
	}
	return await response.arrayBuffer();
}

async function loadScratchProject(id) {
	const arrbuffer = await downloadScratch(id);
	const data = new Uint8Array(arrbuffer);
	if (isScratch1(data)) {
		return decodeScratch1Project(data);
	} else {
		return decodeScratch2or3Project(data);
	}
}

async function loadFromSB(bytes) {
	if (isScratch1(bytes)) {
		return decodeScratch1Project(bytes);
	}
	return decodeScratch2or3Project(bytes);
}

loadScratchProject(523967150);







