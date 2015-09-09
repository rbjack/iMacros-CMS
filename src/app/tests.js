(function() {

	var errorMsg = "iMacrosCSVError",   // unique error message
	url = "",                           // Current URL
	env = [],                           // List of approved sites to run scripts against
	profile = {},                       // Profile data to login to database
	flag = false,                       // Shut off switch to script step through
	testAll = true,                     // Run all possible tests, or just the ones unapplied
	unapplied = 0,                      // Total of all unapplied lists
	scriptList = [],                    // List of scripts to run
	testResults = [],                   // List of test results to run
	

	// Return last extract from dynamic IIM
	getExtract = function(load) {
		iimPlay(load);
		if (iimGetErrorText() !== "OK") {
			return errorMsg;
		}

		return iimGetExtract(1);
	},

	// iMacros way of extracting single CSV cell
	getCSVCell = function(csvTarget, csvLinePosition, columnTarget, columnsTotal) {
		var load;
		load  = "CODE:";
		load += "SET !DATASOURCE "+ csvTarget + "\n";
		load += "SET !DATASOURCE_COLUMNS "+ columnsTotal + "\n";
		load += "SET !DATASOURCE_LINE "+ csvLinePosition + "\n";
		load += "SET !EXTRACT NULL" + "\n";
		load += "SET !EXTRACT {{!col" + columnTarget + "}}" + "\n";
		
		return getExtract(load);
	},

	replaceSpaces = function(string) {
		return string.replace(/ /g, "<SP>");
	},

	escapeQuotes = function(string) {
		return string.replace(/\"/g, "\"\"");
	},

	// pares env.csv to authorize scripts
	setEnv = function() {
		var csvfile = "environment.csv",
				data = {},
				linePosition = 1,
				hasLine = true;

		do {
			// extract cells
			data.type = getCSVCell(csvfile, linePosition, 1, 2);
			data.url = getCSVCell(csvfile, linePosition, 2, 2);

			if (data.type === errorMsg || data.url === errorMsg) {
				hasLine = false;
			}
			else {
				if (data.type !== "Type" || data.url !== "URL") {
					env.push({type: data.type, url: data.url});
				}
			}

			linePosition = linePosition + 1;
		}
		while (hasLine === true);
	},

	// This will set and determine if the scripts should run on current url
	validURL = function() {
		var load,
				pos = -1;

		load  = "CODE:";
		load += "SET !EXTRACT NULL" + "\n";
		load += "SET !EXTRACT {{!URLCURRENT}}"+ "\n";

		url = getExtract(load);
		
		if (url !== errorMsg) {

			pos = env.map(function(e) { return e.url; }).indexOf(url);
			if (pos !== -1) {
				envType = env[pos].type;
				return true;
			}
		}

		return false;
	},

	// Store profile settings for later reference
	getProfile = function() {

		var csvfile = "profile.csv",
				data = {},
				linePosition = 1,
				hasLine = true;

		do {
			data.username = getCSVCell(csvfile, linePosition, 1, 4);
			data.password = getCSVCell(csvfile, linePosition, 2, 4);
			data.encryptionSetting = getCSVCell(csvfile, linePosition, 3, 4);
			data.imacrosdirectory = getCSVCell(csvfile, linePosition, 4, 4);


			if (data.username === errorMsg || data.password === errorMsg || data.encryptionSetting === errorMsg || data.imacrosdirectory === errorMsg) {
				hasLine = false;
			}
			else {
				if (data.username !== "CMSUsername" && data.password !== "CMSPassword" || data.encryptionSetting !== "iMacrosEncryptionSetting" || data.encryptionSetting !== "NO|STOREDKEY|TMPKEY" || data.imacrosdirectory === "iMacrosDirectory") {
					profile.username = data.username;
					profile.password = data.password;
					profile.encryptionSetting = data.encryptionSetting;
					profile.imacrosdirectory = data.imacrosdirectory;
				}
			}

			linePosition = linePosition + 1;
		}
		while (hasLine === true);
	},

	// store scriptlist into an array
	getScriptList = function() {

		var csvfile = profile.imacrosdirectory + "scripts/scriptlist.csv",
				data = {},
				linePosition = 1,
				hasLine = true;

		do {
			// extract all cells in the URL column
			data.script = getCSVCell(csvfile, linePosition, 1, 6);
			data.test = getCSVCell(csvfile, linePosition, 2, 6);
			data.author = replaceSpaces(getCSVCell(csvfile, linePosition, 3, 6));
			data.ref = escapeQuotes(replaceSpaces(getCSVCell(csvfile, linePosition, 4, 6)));
			data.dateup = replaceSpaces(getCSVCell(csvfile, linePosition, 5, 6));
			data.datedown = replaceSpaces(getCSVCell(csvfile, linePosition, 6, 6));

			if (data.script === errorMsg || data.test === errorMsg || data.author === errorMsg || data.ref === errorMsg || data.dateup === errorMsg || data.datedown === errorMsg) {
				hasLine = false;
			}
			else {
				if (data.script !== "ScriptName" || data.test !== "TestList" || data.author !== "Author" || data.ref !== "Reference" || data.dateup !== "DateCreated" || data.datedown !== "DateDatabaseAdminApplied") {

					scriptList.push({script: data.script, test: data.test, author: data.author, ref: data.ref, dateup: data.dateup, datedown: data.datedown});

					if (data.datedown === "0") {
						unapplied = unapplied + 1;
					}
				}
			}

			linePosition = linePosition + 1;
		}
		while (hasLine === true);
	},

	// run the tests
	getTests = function() {

		var i,
				collate = true,
				data = {},
				hasLine = true,
				linePosition = 1;

		for (i = 0; i < scriptList.length; i = i + 1) {

			// only collect unapplied scripts
			if (testAll === false && scriptList[i].datedown !== "0") {
				collate = false;
			}

			// only collect the script if it has a testlist
			if (collate && scriptList[i].test !== "undefined") {
				
				do {
					data.testscript = getCSVCell(profile.imacrosdirectory+"scripts/"+scriptList[i].test, linePosition, 1, 3);
					data.assertion = getCSVCell(profile.imacrosdirectory+"scripts/"+scriptList[i].test, linePosition, 2, 3);
					data.outcome = escapeQuotes(replaceSpaces(getCSVCell(profile.imacrosdirectory+"scripts/"+scriptList[i].test, linePosition, 3, 3)));

					if (data.testscript === errorMsg || data.outcome === errorMsg) {
						hasLine = false;
					}
					else {
						if (data.testscript !== "TestScript" || data.outcome !== "Outcome") {

							//"Result","TestScript","TestList","ReferenceScript","Author","Assertion","Outcome"
							testResults.push({results: "?", testscript: data.testscript, test: scriptList[i].test, script: scriptList[i].script, author: scriptList[i].author, assertion: data.assertion, outcome: data.outcome});
						}
					}
					
					linePosition = linePosition + 1;
				}
				while (hasLine === true);

			}

			// reset
			collate = true;
			data = {};
		}

	},

	setTests = function() {
		var i,
				pos;

		for (i = 0; i < testResults.length; i = i + 1) {

			// set profile variables
			iimSet ("URL", url);
			iimSet ("USERNAME", profile.username);
			iimSet ("PASSWORD", profile.password);
			iimSet ("ENCRYPTION", profile.encryptionSetting);
			iimSet ("DIRECTORY", profile.imacrosdirectory);

			// display script name
			iimDisplay("Running:\nscripts/"+testResults[i].testscript);

			// run macros
			iimPlay(profile.imacrosdirectory+"scripts/"+testResults[i].testscript,60);
			
			if (testResults[i].assertion === "true") {
				if (iimGetErrorText() === "OK") {
					testResults[i].results = "pass";
				}
				else {
					testResults[i].results = "fail";
				}
			}

			else {
				if (iimGetErrorText() === "OK") {
					testResults[i].results = "fail";
				}
				else {
					testResults[i].results = "pass";
				}
			}
			
		}
	},

	setTestsUpdate = function() {
		var i,
				load,
				data = {},
				linePosition = 1,
				hasLine = true,
				csvfile = "testresults.csv";

		load  = "CODE:";
		load += "SET !ERRORIGNORE YES" + "\n";
		load += "FILEDELETE NAME="+ profile.imacrosdirectory +"scripts/" + csvfile + "\n";
		load += "SET !ERRORIGNORE NO" + "\n";
		load += "SET !EXTRACT NULL" + "\n";
		load += "ADD !EXTRACT Result" + "\n";
		load += "ADD !EXTRACT TestScript" + "\n";
		load += "ADD !EXTRACT TestList" + "\n";
		load += "ADD !EXTRACT ReferenceScript" + "\n";
		load += "ADD !EXTRACT Author" + "\n";
		load += "ADD !EXTRACT Assertion" + "\n";
		load += "ADD !EXTRACT Outcome" + "\n";
		load += "SAVEAS TYPE=EXTRACT FOLDER="+ profile.imacrosdirectory +"scripts/ FILE=" + csvfile + "\n";
		for (i = 0; i < testResults.length; i = i + 1) {
			load += "ADD !EXTRACT " + testResults[i].results + "\n";
			load += "ADD !EXTRACT " + "scripts/"+ testResults[i].testscript + "\n";
			load += "ADD !EXTRACT " + "scripts/"+ testResults[i].test + "\n";
			load += "ADD !EXTRACT " + "scripts/"+ testResults[i].script + "\n";
			load += "ADD !EXTRACT " + testResults[i].author + "\n";
			load += "ADD !EXTRACT " + testResults[i].assertion + "\n";
			load += "ADD !EXTRACT " + testResults[i].outcome + "\n";
			load += "SAVEAS TYPE=EXTRACT FOLDER="+ profile.imacrosdirectory +"scripts/ FILE=" + csvfile + "\n";
		}
		iimPlay(load);
	},

	init = function() {

		var flag = false;

		// Get Authorized Enviornment(s)
		if (!flag) {

			iimDisplay("Parsing config/environment.csv");
			setEnv();
			if (env.length <= 0) {
				flag = true;
				alert("There was an error while trying to load the config/environment.csv");
			}
			else {
				iimDisplay("Parsed config/environment.csv")
			}
		}

		// Set current URL, which should validate against the Enviornment(s)
		if (!flag) {

			iimDisplay("Matching currentURL with config/environment.csv");
			if (!validURL()) {
				flag = true;
				alert("The current URL is not a set environment starting position");
			}
		}

		// Get Profile data
		if (!flag) {

			iimDisplay("Parsing config/profile.csv");
			getProfile();
			if (profile.username === errorMsg || profile.password === errorMsg || profile.encryptionSetting === errorMsg) {
				flag = true;
				alert("Their was an error while trying to load the profile.csv");
			}
			else {
				iimDisplay("Parsed config/profile.csv");
			}
		}

		// save scriptlist.csv to array
		if (!flag) {

			iimDisplay("Load scriptlist.csv");
			getScriptList();
			if (scriptList.length <= 0) {
				flag = true;
				alert("There are no scripts detected in scriptlist.csv");
			}
			else {
				iimDisplay("Loaded scriptlist.csv")
			}
		}

		// test unapplied or all scripts not in database
		if (!flag) {

			iimDisplay("Flight Check");

			// No unapplied scripts, test all?
			if (scriptList.length >= 1 && unapplied === 0) {
				flag = !confirm("There are no unapplied scripts to test.\nClick 'OK' to test all scripts, otherwise click 'Cancel'.");
			}

			// Test only unapplied scripts?
			else if (unapplied >= 1 && scriptList.length !== unapplied) {
				testAll = !confirm("There's "+ unapplied + ((unapplied !== 1) ? " unapplied scripts" : " unapplied script") +" detected.\nClick 'OK' to run only "+ ((unapplied !== 1) ? "those " : "that ") + unapplied +", otherwise click 'Cancel' to run all.");
			}

			// No scripts
			else if (scriptList.length === 0) {
				iimDisplay("There are no scripts to test");
				flag = true;
				alert("There are no scripts to test");
			}
		}

		// Get Tests
		if (!flag) {

			getTests();
			if (testResults.length === 0) {
				iimDisplay("No test scripts detected");
				flag = true;
				alert("No test scripts detected");
			}
		}

		// Run Tests
		if (!flag) {

			setTests();
			setTestsUpdate();
		}

		if (!flag) {
			iimDisplay("Complete");
		}

	};


	//Initiate Script
	init();

})();