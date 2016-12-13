/*
 * Cloud code for a Grassland Curing Project nemp_prod_vic
 * Updating history: 		21/06/2016
 * 							29/07/2016
 * 							26/08/2016: added use of "turf" package for spatial analysis and manipulation tools;
										updated "getPrevSimpleObsSharedInfoForState" & "getSharedPrevCuringForStateForInputToVISCA"
							01/12/2016: NEMP-1-154: Running the "applyValidationByException" Cloud function creates incorrect String on the "SharedBy" column of the GCUR_OBSERVATION table
							13/12/2016: NEMP-1-151: Remove unnecessary Parse.User.logIn(SUPERUSER, SUPERPASSWORD) and Parse.Cloud.useMasterKey() in the Cloud function
 */

var _ = require('underscore');
var turf = require('turf');							// https://www.npmjs.com/package/turf

var MAX_DAYS_ALLOWED_FOR_PREVIOUS_OBS = 30;		// An obs with the FinalisedDate older than this number should not be returned and treated as Last Season data

//var SHARED_WITH_STATES = ["NSW","SA"];

// Use Parse.Cloud.define to define as many cloud functions as you want.
// For example:
Parse.Cloud.define("hello", function(request, response) {
  response.success("Hello world from " + process.env.APP_NAME);
});

Parse.Cloud.define("countOfObservations", function(request, response) {
  var query = new Parse.Query("GCUR_OBSERVATION");

  query.count({
    success: function(count) {
      // The count request succeeded. Show the count
      response.success(count);
    },
    error: function(error) {
      response.error("OBS lookup failed");
    }
  });
});

/**
 * Populate all ShareBy{STATE} columns available by "True" beforeSave a new Observation is added
 */
Parse.Cloud.beforeSave("GCUR_OBSERVATION", function(request, response) {
	if(request.object.isNew()) {
		// Adding a new GCUR_OBSERVATION object
		console.log("Adding a new Observation.");
		var sharedJurisSettingsQ = new Parse.Query("GCUR_SHARED_JURIS_SETTINGS");
		
		sharedJurisSettingsQ.find().then(function(sjsObjs) {
			var sharedWithJurisArr = [];

			for (var i = 0; i < sjsObjs.length; i ++) {
				var jurisdiction = sjsObjs[i].get("Jurisdiction");
				sharedWithJurisArr.push(jurisdiction);
			}
			
			var sharedByArr = [];
			
			for (var i = 0; i < sharedWithJurisArr.length; i ++) {
				sharedByArr.push({
					"st" : sharedWithJurisArr[i],
					"sh" : true
				});
			}
			
			request.object.set("SharedBy", JSON.stringify(sharedByArr));
			
			response.success();
		});
	} else
		response.success();
});

/**
 * Retrieve shared infos for shared locations for State
 */
Parse.Cloud.define("getPrevSimpleObsSharedInfoForState", function(request, response) {
	var stateName = request.params.state;
	
	var isBufferZonePntsForStateApplied = true;
	var bufferZonePntsForState = null;
	
	var sharedInfos = [];
	
	var querySharedJurisSettings = new Parse.Query("GCUR_SHARED_JURIS_SETTINGS");
	querySharedJurisSettings.equalTo("Jurisdiction", stateName);		// Find the record for the input jurisdiction

	// Find the "bufferZonePnts" for the input jurisdiction
	// "bufferZonePnts" can be either the set point array, or "null" or "undefined" as well.
	querySharedJurisSettings.first().then(function(jurisSetting) {
		bufferZonePntsForState = jurisSetting.get("bufferZonePnts");
			
		if ((bufferZonePntsForState == null) || (bufferZonePntsForState == undefined))
			isBufferZonePntsForStateApplied = false;
			
		return Parse.Promise.as("'bufferZonePnts' is found for jurisdiction " + stateName);
	}, function(error) {
		console.log("There was an error in finding Class 'GCUR_SHARED_JURIS_SETTINGS', but we continue to find previous observations.");
		return Parse.Promise.as("There was an error in finding Class 'GCUR_SHARED_JURIS_SETTINGS', but we continue to find previous observations.");
	}).then(function() {
		console.log("isBufferZonePntsForStateApplied = " + isBufferZonePntsForStateApplied + " for " + stateName);
		
		var queryObservation = new Parse.Query("GCUR_OBSERVATION");
		queryObservation.equalTo("ObservationStatus", 1);			// Previous week's observations
		queryObservation.limit(1000);
		
		return queryObservation.find(); 
	}).then(function(obs) {
		//console.log("obs.length=" + obs.length);
		for (var j = 0; j < obs.length; j ++) {
			// check if FinalisedDate is 30 days away
			var isPrevObsTooOld = isObsTooOld(obs[j].get("FinalisedDate"));
			if (!isPrevObsTooOld) {
				var locObjId = obs[j].get("RemoteLocationId");
				var locName = obs[j].get("LocationName");
				var locStatus = obs[j].get("LocationStatus");
				var distNo = obs[j].get("DistrictNo");
				var locLat = obs[j].get("Lat");
				var locLng = obs[j].get("Lng");
					
				var obsObjId = obs[j].id;
					
				var prevOpsCuring = obs[j].get("BestCuring");
				var prevOpsDate = obs[j].get("BestDate");
					
				var finalisedDate = obs[j].get("FinalisedDate");
	
				// In Array; convert raw string to JSON Array
				// For example, "[{"st":"VIC","sh":false},{"st":"QLD","sh":true},{"st":"NSW","sh":true}]"
				if (obs[j].has("SharedBy")) {
						
					var sharedByInfo = JSON.parse(obs[j].get("SharedBy"));
						
					var isSharedByState;
						
					for (var p = 0; p < sharedByInfo.length; p ++) {
						if (sharedByInfo[p]["st"] == stateName) {
							isSharedByState = sharedByInfo[p]["sh"];
								
							var returnedItem = {
								"obsObjId" : obsObjId,
								"locObjId"	: locObjId,
								"locName" : locName,
								"locStatus" : locStatus,
								"distNo" : distNo,
								"isSharedByState" : isSharedByState,
								"prevOpsCuring" : prevOpsCuring,
								"prevOpsDate" : prevOpsDate,
								"lat" : locLat,
								"lng" : locLng,
								"finalisedDate" : finalisedDate
							};
								
							sharedInfos.push(returnedItem);
							break;
						}
					}
				}
			}
		}
		
		var returnedObj = {
			"state" : stateName,
			"sharedInfos" : sharedInfos
		};
		
		// If isBufferZonePntsForStateApplied is false OR sharedInfos contains zero element
		if ((isBufferZonePntsForStateApplied == false) || (sharedInfos.length < 1)) {
			console.log("Not to apply buffer zone for " + stateName + " OR sharedInfos contains zero element.");
		}
		// apply Turf package for buffering
		else {
			var searchWithin = {
					"type": "FeatureCollection",
					"features": [
				      {
				    	  "type": "Feature",
				    	  "properties": {},
				    	  "geometry": {
					        "type": "Polygon",
					        "coordinates": new Array()
					      }
				      }
				    ]
			};
			
			bufferZonePntsForState = JSON.parse(bufferZonePntsForState);
			searchWithin["features"][0]["geometry"]["coordinates"].push(bufferZonePntsForState);

			var pointsToCheck = {
					"type": "FeatureCollection",
					"features": []
			};
			
			for (var j = 0; j < sharedInfos.length; j++) {
				var obsObjId = sharedInfos[j]["obsObjId"];
				var lat = sharedInfos[j]["lat"];
				var lng = sharedInfos[j]["lng"];
				
				var featureObj = {
						"type": "Feature",
					    "properties": {"obsObjId" : obsObjId},
					    "geometry": {
					    	"type": "Point",
					    	"coordinates": [lng, lat]
					    }
				};
				
				pointsToCheck["features"].push(featureObj);
			}
			
			// Use Turf to retrieve points that are within the buffer zone
			var ptsWithin = turf.within(pointsToCheck, searchWithin);
			
			var sharedInfosFiltered = [];
			
			console.log("Out of a total of " + sharedInfos.length + " observations, " + ptsWithin["features"].length + " are within the buffer zone of " + stateName);
			
			for (var m = 0; m < ptsWithin["features"].length; m++) {
				for (var n = 0; n < sharedInfos.length; n++) {
					if (ptsWithin["features"][m]["properties"]["obsObjId"] == sharedInfos[n]["obsObjId"]) {
						sharedInfosFiltered.push(sharedInfos[n]);
						break;
					}
				}
			}
			
			returnedObj = {
				"state" : stateName,
				"sharedInfos" : sharedInfosFiltered
			};
		}
		
		return response.success(returnedObj);
	}, function(error) {
		response.error("Error: " + error.code + " " + error.message);
	});
});

/**
 * Retrieve previous curing values (shared only!) for shared locations for State
 * This Cloud function is called from the VISCA model directly!
 */
Parse.Cloud.define("getSharedPrevCuringForStateForInputToVISCA", function(request, response) {
	var stateName = request.params.state;
	
	var isBufferZonePntsForStateApplied = true;
	var bufferZonePntsForState = null;
	
	var sharedObsArr = [];
	
	var querySharedJurisSettings = new Parse.Query("GCUR_SHARED_JURIS_SETTINGS");
	querySharedJurisSettings.equalTo("Jurisdiction", stateName);		// Find the record for the input jurisdiction

	// Find the "bufferZonePnts" for the input jurisdiction
	// "bufferZonePnts" can be either the set point array, or "null" or "undefined" as well.
	querySharedJurisSettings.first().then(function(jurisSetting) {
		bufferZonePntsForState = jurisSetting.get("bufferZonePnts");
			
		if ((bufferZonePntsForState == null) || (bufferZonePntsForState == undefined))
			isBufferZonePntsForStateApplied = false;
			
		return Parse.Promise.as("'bufferZonePnts' is found for jurisdiction " + stateName);
	}, function(error) {
		console.log("There was an error in finding Class 'GCUR_SHARED_JURIS_SETTINGS', but we continue to find previous observations.");
		return Parse.Promise.as("There was an error in finding Class 'GCUR_SHARED_JURIS_SETTINGS', but we continue to find previous observations.");
	}).then(function() {
		console.log("isBufferZonePntsForStateApplied = " + isBufferZonePntsForStateApplied + " for " + stateName);
	
		var queryObservation = new Parse.Query("GCUR_OBSERVATION");
		queryObservation.equalTo("ObservationStatus", 1);			// Previous week's observations
		queryObservation.limit(1000);
		
		return queryObservation.find();
	}).then(function(obs) {
		//console.log("obs.length=" + obs.length);
		for (var j = 0; j < obs.length; j ++) {
			// check if FinalisedDate is 30 days away
			var isPrevObsTooOld = isObsTooOld(obs[j].get("FinalisedDate"));
			if (!isPrevObsTooOld) {
				var locStatus = obs[j].get("LocationStatus");
				
				if ( locStatus.toLowerCase() != "suspended" ) {
					var locObjId = obs[j].get("RemoteLocationId");
					var locName = obs[j].get("LocationName");
					var locLat = obs[j].get("Lat");
					var locLng = obs[j].get("Lng");					
					var obsObjId = obs[j].id;					
					var prevOpsCuring = obs[j].get("BestCuring");
					
					// In Array; convert raw string to JSON Array
					// For example, "[{"st":"VIC","sh":false},{"st":"QLD","sh":true},{"st":"NSW","sh":true}]"
					if (obs[j].has("SharedBy")) {
						
						var sharedByInfo = JSON.parse(obs[j].get("SharedBy"));
						
						var isSharedByState;
						
						for (var p = 0; p < sharedByInfo.length; p ++) {
							if ( (sharedByInfo[p]["st"] == stateName) && (sharedByInfo[p]["sh"]) ) {
								var sharedObs = {
									"obsObjId" : obsObjId,
									"locObjId"	: locObjId,
									"locName" : locName,
									"bestCuring" : prevOpsCuring,
									"lat" : locLat,
									"lng" : locLng
								};
								
								sharedObsArr.push(sharedObs);
								break;
							}
						}
					}
				}
			}
		}
		
		// Sort by locName, case-insensitive, A-Z
		sharedObsArr.sort(sort_by('locName', false, function(a){return a.toUpperCase()}));
		
		var returnedObj = {
			"state" : stateName,
			"sharedObsArr" : sharedObsArr
		};
		
		// If isBufferZonePntsForStateApplied is false OR sharedObsArr contains zero element
		if ((isBufferZonePntsForStateApplied == false) || (sharedObsArr.length < 1)) {
			console.log("Not to apply buffer zone for " + stateName + " OR sharedObsArr contains zero element.");
		}
		// apply Turf package for buffering
		else {
			var searchWithin = {
					"type": "FeatureCollection",
					"features": [
				      {
				    	  "type": "Feature",
				    	  "properties": {},
				    	  "geometry": {
					        "type": "Polygon",
					        "coordinates": new Array()
					      }
				      }
				    ]
			};
			
			bufferZonePntsForState = JSON.parse(bufferZonePntsForState);
			searchWithin["features"][0]["geometry"]["coordinates"].push(bufferZonePntsForState);

			var pointsToCheck = {
					"type": "FeatureCollection",
					"features": []
			};
			
			for (var j = 0; j < sharedObsArr.length; j++) {
				var obsObjId = sharedObsArr[j]["obsObjId"];
				var lat = sharedObsArr[j]["lat"];
				var lng = sharedObsArr[j]["lng"];
				
				var featureObj = {
						"type": "Feature",
					    "properties": {"obsObjId" : obsObjId},
					    "geometry": {
					    	"type": "Point",
					    	"coordinates": [lng, lat]
					    }
				};
				
				pointsToCheck["features"].push(featureObj);
			}
			
			// Use Turf to retrieve points that are within the buffer zone
			var ptsWithin = turf.within(pointsToCheck, searchWithin);
			
			var sharedObsArrFiltered = [];
			
			console.log("Out of a total of " + sharedObsArr.length + " observations, " + ptsWithin["features"].length + " are within the buffer zone of " + stateName);
			
			for (var m = 0; m < ptsWithin["features"].length; m++) {
				for (var n = 0; n < sharedObsArr.length; n++) {
					if (ptsWithin["features"][m]["properties"]["obsObjId"] == sharedObsArr[n]["obsObjId"]) {
						sharedObsArrFiltered.push(sharedObsArr[n]);
						break;
					}
				}
			}
			
			returnedObj = {
				"state" : stateName,
				"sharedObsArr" : sharedObsArrFiltered
			};
		}
		
		return response.success(returnedObj);
	}, function(error) {
		response.error("Error: " + error.code + " " + error.message);
	});
});

Parse.Cloud.define("updateSharedByInfo", function(request, response) {
	/*
	 * "{\"forState\":\"NSW\", \"sharedInfos\":[{\"obsObjId\":\"syCUGywaao\", \"sh\":true},{\":[{\"obsObjId\":\"TuhtjP9rke\", \"sh\":false},{\":[{\"obsObjId\":\"YEWf4x4oSl\", \"sh\":true}]}" 
	 */
	var forState = request.params.forState;
	var sharedInfos = request.params.sharedInfos;
	
	var obsObjIds = [];
	
	for (var i = 0; i < sharedInfos.length; i ++) {
		obsObjIds.push(sharedInfos[i]["obsObjId"]);
	}
	
	// Finds GCUR_OBSERVATION from any of objectId from the input obsObjId array
	var queryObservation = new Parse.Query("GCUR_OBSERVATION");
	queryObservation.containedIn("objectId", obsObjIds);
	queryObservation.limit(1000);
	queryObservation.find().then(function(obs) {
		// loops through all Observation records contained in the input obs list
		for (var j = 0; j < obs.length; j ++) {
			for (var i = 0; i < sharedInfos.length; i ++) {
				if (obs[j].id == sharedInfos[i]["obsObjId"]) {
					
					// [{"st":"VIC","sh":true},{"st":"QLD","sh":true},{"st":"NSW","sh":false}]
					var oldSharedBy = JSON.parse(obs[j].get("SharedBy"));
					var newIsSharedForState = sharedInfos[i]["sh"];
					
					for (var p = 0; p < oldSharedBy.length; p ++) {
						// re-set the SharedBy array with the new "sh" boolean
						if (oldSharedBy[p]["st"] == forState) {
							oldSharedBy[p]["sh"] = newIsSharedForState;
							break;
						}
					}
					
					obs[j].set("SharedBy", JSON.stringify(oldSharedBy));
					break ;
				}
			}
		}
		return Parse.Object.saveAll(obs);
		//return response.success();
	}).then(function(obsList) {
		// All the objects were saved.
		console.log("Updated SharedBy column on GCUR_OBSERVATION table. Updated obs count: " + obsList.length);
		response.success(true);  //saveAll is now finished and we can properly exit with confidence :-)
	}, function(error) {
		response.error("Error: " + error.code + " " + error.message);
	});
});

/**
 * Finalise GCUR_OBSERVATION on the Parse.com side.
 * - Finalise GCUR_OBSERVATION class - records are uploaded from the SQL database CFA_FEM_GC via "UploadObsForInterstateToParse.py"
 * - Change ObservationStatus from 1 to 2 for archived observations
 */
Parse.Cloud.define("finaliseObservationOnParse", function(request, response) {
	var result = false;
	
	console.log("Triggering the Cloud Function 'finaliseObservationOnParse'");
	
	// Change all GCUR_OBSERVATION records with ObservationStatus being 1 to 2
	queryPrev = new Parse.Query("GCUR_OBSERVATION");
	queryPrev.equalTo("ObservationStatus", 1);
	queryPrev.limit(1000);
	queryPrev.find().then(function(prev_observations) {
		//return Parse.Object.destroyAll(prev_observations);
		for (var i = 0; i < prev_observations.length; i ++) {
			var obs = prev_observations[i];
			obs.set("ObservationStatus", 2);
		}
		
		return Parse.Object.saveAll(prev_observations, { useMasterKey: true });
	}).then(function() {
		console.log("All GCUR_OBSERVATION records with ObservationStatus being 1 have been succssfully changed to archived observations.");
		response.success(true);  //saveAll is now finished and we can properly exit with confidence :-)
	}, function(error) {
		console.log("Error while running saveAll()");
		response.error("Error: " + error.code + " " + error.message);
	});
});

/**********************************************************************************************************************************************/

/**
 * An Underscore utility function to find elements in array that are not in another array;
 * used in the cloud function "applyValidationByException"
 */
function inAButNotInB(A, B) {
	return _.filter(A, function (a) {
		return !_.contains(B, a);
	});
}

/********
* Array utility functions
********/
Array.prototype.contains = function (obj) {
    for (var i = 0; i < this.length; i++) {
        if (this[i] === obj) {
            return true;
        }
    }
    return false;
}

Array.prototype.each = function(fn){
    fn = fn || Function.K;
     var a = [];
     var args = Array.prototype.slice.call(arguments, 1);
     for(var i = 0; i < this.length; i++){
         var res = fn.apply(this,[this[i],i].concat(args));
         if(res != null) a.push(res);
     }
     return a;
};

Array.prototype.uniquelize = function(){
     var ra = new Array();
     for(var i = 0; i < this.length; i ++){
         if(!ra.contains(this[i])){
            ra.push(this[i]);
         }
     }
     return ra;
};

Array.complement = function(a, b){
     return Array.minus(Array.union(a, b),Array.intersect(a, b));
};

Array.intersect = function(a, b){
     return a.uniquelize().each(function(o){return b.contains(o) ? o : null});
};

Array.minus = function(a, b){
     return a.uniquelize().each(function(o){return b.contains(o) ? null : o});
};

Array.union = function(a, b){
     return a.concat(b).uniquelize();
};

/******
Function to check if today is Wednesday (GMT); time is between 10.45 pm and 11.15 pm (GMT) for Request for Validation email Job;
this is equivalent to Thursday 8:45 am and 9:15 am (AEST, GMT+10);
For Daylight Saving, 09:45 pm and 10:15 pm (GMT) = 8:45 am and 9:15 am (GMT+11)
******/
function isTodayWednesday() {
	var today = new Date();
	if(today.getDay() == 3)
		return true;
	else
		return false;
}

function isToSendRequestForValidationEmail() {
	var startTime = JOB_START_TIME;
	var endTime = JOB_END_TIME;

	var curr_time = getval();
	
	if ((isTodayWednesday()) && (get24Hr(curr_time) > get24Hr(startTime) && get24Hr(curr_time) < get24Hr(endTime))) {
	    //in between these two times
		return true;
	} else {
		return false;
	}
}

function get24Hr(time){
    var hours = Number(time.match(/^(\d+)/)[1]);
    var AMPM = time.match(/\s(.*)$/)[1];
    if(AMPM == "PM" && hours<12) hours = hours+12;
    if(AMPM == "AM" && hours==12) hours = hours-12;
    
    var minutes = Number(time.match(/:(\d+)/)[1]);
    hours = hours*100+minutes;
    console.log(time +" - "+hours);
    return hours;
}

function getval() {
    var currentTime = new Date()
    var hours = currentTime.getHours()
    var minutes = currentTime.getMinutes()

    if (minutes < 10) minutes = "0" + minutes;

    var suffix = "AM";
    if (hours >= 12) {
        suffix = "PM";
        hours = hours - 12;
    }
    if (hours == 0) {
        hours = 12;
    }
    var current_time = hours + ":" + minutes + " " + suffix;

    return current_time;
}

/**
 * Returns the last day of the a year and a month
 * e.g. getLastDayOfMonth(2009, 9) returns 30;
 */
function getLastDayOfMonth(Year, Month) {
	var newD = new Date( (new Date(Year, Month,1))-1 );
    return newD.getDate();
}

/**
 * Returns a description of the current date in AEST
 * Parameters:
 * - isDLS: boolean; indicates if it is currently Daylight Saving Time.
 */
function getTodayString(isDLS) {
	var today = new Date();	// ALWAYS IN UTC TIME
	// NOTE: this is to initialize a JS date object in the timezone of the computer/server the function is called.
	// So this is UTC time. There are 10 (11) hrs difference between UTC time and Australian Eastern Standard Time (Daylight Saving Time).
	
	var dd = today.getDate();
	var mm = today.getMonth() + 1;	//January is 0!
	var yyyy = today.getFullYear();
	var hr = today.getHours();	// from 0 - 23!
	
	var lastDayOfTheMonth = getLastDayOfMonth(yyyy, mm);
	
	// is DayLight Saving enabled
	if (isDLS) {
		if (hr>=13)	// "13" hr in UTC is equivalent to "00" hr in AEST the next day!
			dd = dd + 1;
	} else {
		if (hr>=14)	// "14" hr in UTC is equivalent to "00" hr in AEST the next day!
			dd = dd + 1;
	}
	
	// fix the cross-month issue
	if (dd > lastDayOfTheMonth) {
		dd = 1;	// first day of next month
		mm = mm + 1;	// next month
	}
	
	// fix the cross-year issue
	if (mm > 12) {
		mm = 1;
		yyyy = yyyy + 1;
	}
	
	if(dd<10)
		dd = '0' + dd

	if(mm<10)
		mm = '0' + mm

	var strToday = dd + '/' + mm + '/' + yyyy;
	
	return strToday;
}

/*
 * Sort the Array of JSON by the value of a key/field in the JSON
 */
var sort_by = function(field, reverse, primer){
	var key = primer ? function(x) {return primer(x[field])} : function(x) {return x[field]};

	reverse = !reverse ? 1 : -1;

	return function (a, b) {
		return a = key(a), b = key(b), reverse * ((a > b) - (b > a));
	} 
}

/*********************************************************************************************************************************************/
/**
 * Returns number of days between two Date objects
 */
function numDaysBetween(d1, d2) {
	var diff = Math.abs(d1.getTime() - d2.getTime());
	return diff / (1000 * 60 * 60 * 24);
};

/**
 * Returns a boolean if a previous obs (ObservationStatus = 1) is MAX_DAYS_ALLOWED_FOR_PREVIOUS_OBS days older than Today.
 */
function isObsTooOld(finalisedDate) {
	var today = new Date();
	var numberOfDaysBetween = numDaysBetween(today, finalisedDate);
	
	if (numberOfDaysBetween > MAX_DAYS_ALLOWED_FOR_PREVIOUS_OBS)
		return true;
	else
		return false;
}
/*********************************************************************************************************************************************/
