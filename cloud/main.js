/*
 * Cloud code for a Grassland Curing Project nemp_prod_vic
 * Last updated on 5.00 pm, 21 June 2016
 * https://nemp-vic-prod.herokuapp.com/parse/
 */

var _ = require('underscore');
var SUPERUSER = process.env.SUPER_USER;
var SUPERPASSWORD = process.env.SUPER_USER_PASS;
var NULL_VAL_INT = -1;
var NULL_VAL_DBL = -1.0;
 
var APP_ID = process.env.APP_ID;
var MASTER_KEY = process.env.MASTER_KEY;

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
	Parse.Cloud.useMasterKey();	
	
	if(!request.object.existed()) {
		
		var sharedJurisSettingsQ = new Parse.Query("GCUR_SHARED_JURIS_SETTINGS");
		
		sharedJurisSettingsQ.find().then(function(sjsObjs) {
			sharedWithJurisArr = [];

			for (var i = 0; i < sjsObjs.length; i ++) {
				var jurisdiction = sjsObjs[i].get("Jurisdiction");
				sharedWithJurisArr.push(jurisdiction);
			}
			
			var sharedByArr = [];
			console.log("sharedWithJurisArr.length=" + sharedWithJurisArr.length);
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
	Parse.Cloud.useMasterKey();
	
	var stateName = request.params.state;
	
	var sharedInfos = [];
	
	var queryObservation = new Parse.Query("GCUR_OBSERVATION");
	queryObservation.equalTo("ObservationStatus", 1);			// Previous week's observations
	queryObservation.limit(1000);
	
	queryObservation.find().then(function(obs) {
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
		return response.success(returnedObj);
	}, function(error) {
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
