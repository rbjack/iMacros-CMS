(function () {

	var originEnvType = "",             // Origin database server integration and updates
	errorMsg = "iMacrosCSVError",       // unique error message
	url = "",                           // Current URL
	datetime = "",                      // datetime
	envType = "",                       // Current Profile Environment
	env = [],                           // List of approved sites to run scripts against
	syncList = [],                      // Keep track of scripts ran against scriptlist
	syncListErrors = [],                // Unscoped scriptlist scripts
	scriptList = [],                    // List of scripts to run
	scriptListApply = [],               // All scripts that aren't already applied
	unSyncedList = [],                  // Unsynced scriptlist scripts
	profile = {},                       // Profile data to login to database


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

	// pares environment to authorize scripts
	setEnv = function() {
		var csvfile = "environment.csv",
				data = {},
				linePosition = 1,
				hasLine = true;

		do {
			// extract cells
			data.type = getCSVCell(csvfile, linePosition, 1, 3);
			data.url = getCSVCell(csvfile, linePosition, 2, 3);
			data.origin = getCSVCell(csvfile, linePosition, 3, 3)

			if (data.type === errorMsg || data.url === errorMsg || data.origin === errorMsg) {
				hasLine = false;
			}
			else {
				if (data.type !== "Type" || data.url !== "URL" || data.origin !== "OriginDatabase") {
					env.push({type: data.type, url: data.url});

					if (data.origin === "yes") {
						originEnvType = data.type;
					}
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

	// Pad given value to the left with "0"
	addZero = function(num) {
		return (num >= 0 && num < 10) ? "0" + num : num + "";
	},

	// Set datetime
	setDatetime = function() {
 		var now = new Date(),
 				datetime;
		datetime  = now.getFullYear() + "-";
		datetime += addZero(now.getMonth() + 1) + "-";
		datetime += addZero(now.getDate()) + "<SP>";
		datetime += addZero(now.getHours()) + ":";
		datetime += addZero(now.getMinutes()) + ":";
		datetime += addZero(now.getSeconds());

		return datetime;
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
				if (data.script !== "ScriptName" || data.test !== "TestList" || data.author !== "Author" || data.ref !== "Reference" || data.dateup !== "DateCreated" || data.datedown !== "DateIntegrated") {
					scriptList.push({script: data.script, test: data.test, author: data.author, ref: data.ref, dateup: data.dateup, datedown: data.datedown});

					// track scripts not applied to adminEvnType database
					if (data.datedown === "0") {
						scriptListApply.push({script: data.script, test: data.test, author: data.author, ref: data.ref, dateup: data.dateup, datedown: data.datedown});
					}
				}
			}

			linePosition = linePosition + 1;
		}
		while (hasLine === true);
	},

	// add synclist to an array
	getSyncList = function() {
		var csvfile = profile.imacrosdirectory + "scripts/synclist.csv",
				data = {},
				linePosition = 1,
				hasLine = true;

		do {
			// extract all cells in the URL column
			data.script = getCSVCell(csvfile, linePosition, 1, 4);
			data.test = getCSVCell(csvfile, linePosition, 2, 4);
			data.author = replaceSpaces(getCSVCell(csvfile, linePosition, 3, 4));
			data.datedown = replaceSpaces(getCSVCell(csvfile, linePosition, 4, 4));

			if (data.script === errorMsg || data.test === errorMsg || data.datedown === errorMsg) {
				hasLine = false;
			}
			else {
				if (data.script !== "") {
					syncList.push({script: data.script, test: data.test, author: data.author, datedown: data.datedown});
				}
			}

			linePosition = linePosition + 1;
		}
		while (hasLine === true);

	},

	// check for synclist errors
	validateListIntegrity = function() {
		var i,
				pos;
		
		for (i = 0; i < syncList.length; i = i + 1) {

			pos = scriptList.map(function(e) { return e.script; }).indexOf(syncList[i].script);
			if (pos === -1) {
				syncListErrors.push(syncList[i].script);
			}
		}

	},

	// get unsynced items
	getUnsynced = function() {
		var i,
				pos;

		for (i = 0; i < scriptListApply.length; i = i + 1) {

			pos = syncList.map(function(e) { return e.script }).indexOf(scriptListApply[i].script);
			if (pos === -1) {
				unSyncedList.push({script: scriptListApply[i].script, test: scriptListApply[i].test, author: scriptListApply[i].author});
			}
		}

	},

	// Run through all scripts that aren't synced
	setUnsynced = function() {
		var i,
				pos;

		for (i = 0; i < unSyncedList.length; i = i + 1) {

			// set profile variables
			iimSet ("URL", url);
			iimSet ("USERNAME", profile.username);
			iimSet ("PASSWORD", profile.password);
			iimSet ("ENCRYPTION", profile.encryptionSetting);
			iimSet ("DIRECTORY", profile.imacrosdirectory);

			// display script name
			iimDisplay("Running:\nscripts/" + unSyncedList[i].script);

			// run macros
			iimPlay(profile.imacrosdirectory + "scripts/" + unSyncedList[i].script,60);

			// add unsynced item to synclist
			syncList.push({script: unSyncedList[i].script, test: unSyncedList[i].test, author: unSyncedList[i].author, datedown: datetime});
			
			// update scriptlist date if ad;]minEnvType detected
			if (envType === originEnvType) {
				pos = scriptList.map(function(e) { return e.script }).indexOf(unSyncedList[i].script);
				scriptList[pos].datedown = datetime;
			}
		}
	},

	// Overwrite current synclist.csv with new udates
	setSyncListUpdate = function() {
		var i,
				load,
				csvfile = "synclist.csv";

		load  = "CODE:";
		load += "SET !ERRORIGNORE YES" + "\n";
		load += "FILEDELETE NAME="+ profile.imacrosdirectory + "scripts/" + csvfile +"\n";
		load += "SET !ERRORIGNORE NO" + "\n";
		load += "SET !EXTRACT NULL" + "\n";
		for(i = 0; i < syncList.length; i = i + 1) {
			load += "ADD !EXTRACT " + syncList[i].script + "\n";
			load += "ADD !EXTRACT " + syncList[i].test + "\n";
			load += "ADD !EXTRACT " + syncList[i].author + "\n";
			load += "ADD !EXTRACT " + syncList[i].datedown + "\n";
			load += "SAVEAS TYPE=EXTRACT FOLDER=" + profile.imacrosdirectory + "scripts/ FILE=" + csvfile + "\n";
		}
		iimPlay(load);
	},

	// Overwrite current scriptlist.csv with new updates
	setScriptListUpdate = function() {
		var i,
				load,
				csvfile = "scriptlist.csv";

		if (envType === originEnvType) {
			load  = "CODE:";
			load += "SET !ERRORIGNORE YES" + "\n";
			load += "FILEDELETE NAME=" + profile.imacrosdirectory + "scripts/" + csvfile + "\n";
			load += "SET !ERRORIGNORE NO" + "\n";
			load += "SET !EXTRACT NULL" + "\n";
			load += "ADD !EXTRACT ScriptName" + "\n";
			load += "ADD !EXTRACT TestList" + "\n";
			load += "ADD !EXTRACT Author" + "\n";
			load += "ADD !EXTRACT Reference" + "\n";
			load += "ADD !EXTRACT DateCreated" + "\n";
			load += "ADD !EXTRACT DateIntegrated" + "\n";
			load += "SAVEAS TYPE=EXTRACT FOLDER=" + profile.imacrosdirectory + "scripts/ FILE=" + csvfile + "\n";
			for(i = 0; i < scriptList.length; i = i + 1) {
				load += "ADD !EXTRACT " + scriptList[i].script + "\n";
				load += "ADD !EXTRACT " + scriptList[i].test + "\n";
				load += "ADD !EXTRACT " + scriptList[i].author + "\n";
				load += "ADD !EXTRACT " + scriptList[i].ref + "\n";
				load += "ADD !EXTRACT " + scriptList[i].dateup + "\n";
				load += "ADD !EXTRACT " + scriptList[i].datedown + "\n";
				load += "SAVEAS TYPE=EXTRACT FOLDER=" + profile.imacrosdirectory + "scripts/ FILE=" + csvfile + "\n";
			}
			iimPlay(load);
		}
	},

	// run script
	init = function() {

		var flag = false; 	// Shut off switch to script step through

		// Get Authorized Enviornment(s)
		if (!flag) {

			iimDisplay("Parsing env.csv");
			setEnv();
			if (env.length <= 0) {
				flag = true;
				alert("There was an error while trying to load the env.csv");
			}
		}

		// Set current URL, which should validate against the Enviornment(s)
		if (!flag) {

			iimDisplay ("Matching currentURL with env.csv");
			if (!validURL()) {
				flag = true;
				alert("The current URL is not a set enviroment starting position");
			}
		}

		// Get Profile data
		if (!flag) {

			iimDisplay ("Parsing profile.csv");
			getProfile();
			if (profile.username === errorMsg || profile.password === errorMsg || profile.encryptionSetting === errorMsg || profile.imacrosdirectory === errorMsg) {
				flag = true;
				alert("Their was an error while trying to load the profile.csv");
			}
		}

		// 'Database Admin' is running on the source database.
		if (!flag) {

			iimDisplay("Database Admin authorization");
			if (envType === originEnvType) {
				flag = !confirm("---    ORIGIN DATABASE DETECTED!    ---\n\n" + originEnvType + " database server environment (source) has been detected.\nClick 'OK' to allow modifications, otherwise click 'Cancel'.");
			}
			else if (envType !== 'LOCAL') {
				flag = !confirm(envType + " database server environment has been detected.\nClick 'OK' to allow modifications, otherwise click 'Cancel'.");
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
		}

		// save synclist.csv (if any) to array
		if (!flag) {

			iimDisplay("Load synclist.csv");
			getSyncList();
		}

		// Check Sync List Integrity
		if (!flag) {

			validateListIntegrity();
			if (syncListErrors.length > 0) {
				iimDisplay("Unscoped Scripts in synclist.csv.\nItems:\n" + syncListErrors.join(", "));
				flag = true;
				alert("There are unscoped entries in the synclist.csv.\nItems:\n" + syncListErrors.join(', '));
			}
		}

		// Set current datetime to developer desktop
		if (!flag) {

			datetime = setDatetime();
		}

		// get unsynced items not in synclist that are on scriptlist
		if (!flag) {

			getUnsynced();
		}
		

		// Developer progression authorization
		if (!flag) {

			iimDisplay("Flight Check");

			// Add all items from scriptlist.csv
			if (scriptListApply.length === unSyncedList.length && unSyncedList.length !== 0) {
				flag = !confirm("All unapplied scripts ("+ unSyncedList.length +") need to be synced.\nClick 'OK' to implement the scriptlist.csv, otherwise click 'Cancel'.");
			}

			// All items in the synclist have ran against the scriptlist
			else if (unSyncedList.length === 0) {
				iimDisplay("The scripts have already been synced.");
				flag = true;
				alert("The scripts have already been synced.");
			}
			
			// Add new entries?
			else if (unSyncedList.length >= 1) {
				flag = !confirm("There's "+ unSyncedList.length + ((unSyncedList.length !== 1) ? " scripts that need" : " script that needs") +" to be added to the "+ envType +" database.\nClick 'OK' to add, otherwise click 'Cancel'.");
			}
			
		}
		
		// run through items not in synclist that are on scriptlist
		if (!flag) {

			iimDisplay("Running Macro Scripts");
			setUnsynced(); // start marco scripts
			setSyncListUpdate(); // update synclist
			setScriptListUpdate(); // update scriptlist if authorized on originEnvType
			iimDisplay ("Complete");
		}

	};

	//Initiate Script
	init();
	
})();


