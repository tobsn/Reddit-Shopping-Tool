var lastInfoBox;
var uservis = {},
		options = {},
		version = "2.0.0",
		defaultoptions = {
			"updateTime": 1440,
			"neSupport": 1,
			"infobox": 1,
			"labelSketchy":0,
			"banlists": [
				"https://www.reddit.com/r/UniversalScammerList/wiki/banlist.json",
				"https://www.reddit.com/r/hardwareswap/wiki/banlist.json",
				"https://www.reddit.com/r/RSTList/wiki/banlist.json"
			],
			"subreddits": [
				"appleswap",
				"avexchange",
				"borrow",
				"canadianhardwareswap",
				"care",
				"detailswap",
				"ecigclassifieds",
				"gameswap",
				"giftcardexchange",
				"hardwareswap",
				"hardwareswapaustralia",
				"hardwareswapeu",
				"hardwareswapuk",
				"indiegameswap",
				"mechmarket",
				"mynintendotrades",
				"phoneswap",
				"redditbay",
				"rotmgtradingpost",
				"slavelabour",
				"starcitizen_trades",
				"steamgameswap",
				"trade"
			]
};


$(function(){
	//check if website is reddit and not options page
	if (window.location.hostname.indexOf("reddit.com") !== -1){
		//load options before running rest of script
		//console.log(chrome.storage);
		chrome.storage.local.get({
			options: defaultoptions
		 }, function(data) {
				options = data.options;
				checkForUpdate();
				labelUsers();
				checkForChanges();
		});
	}
});

function checkForUpdate(){
	//check last update timestamp
	chrome.storage.local.get(['timestamp','version'], function(data){
		//update list if list is X days old or empty or extension was updated
		if(data.timestamp === null || data.version === null || data.version !== version ||
		( options["updateTime"] !== -1 && ( ( Date.now() - data.timestamp )/1000 ) > ( options.updateTime * 60 ) ) ) {
			updateListJSON();
		}
	});
}

function labelUsers(){
	//create an array for users that need to be checked
	$( ".author, .Post__username, .Comment__author, .Post__authorLink" ).each(function() {
		if(uservis[$(this).text().toLowerCase()] === null){
			if(window.location.href.indexOf("reddit.com/message") !== -1 || window.location.href.indexOf("reddit.com/user/") !== -1){
				uservis[$(this).text().toLowerCase()] = "";
			}
			else
				for(var index in options.subreddits){
					if($(this).parents('.thing').attr("data-subreddit") === options.subreddits[index]){
						uservis[$(this).text().toLowerCase()] = "";
					}
				}
		}
	});
	chrome.storage.local.get('users', function(data){
		//loop through banned users and check if uservis contains any banned users
		users = data.users;
		for( var name in users ) {
			//set as banned if not already on the list
			if (users.hasOwnProperty(name) && uservis[name.toLowerCase()] <= 0) {
				//set user info in uservis, and label sketchy users if enabled
				if(options['labelSketchy'] == 1 || users[name].code != 2)
					uservis[name.toLowerCase()] = users[name];
			}
		}
		//automoderator exception
		uservis["automoderator"] = "";

		//loop through all name tags and set them as banned/sketchy, if any
		$( ".author, .Post__username, .Comment__author, .Post__authorLink" ).each(function() {
			//check if user is on the list
			var userData = uservis[$(this).text().toLowerCase()];
			if(userData){
				//translate bancode and add badge next to their name
				var badge = $("<a></a>")
				badge.addClass("rst-banned-" + userData.code);
				badge.addClass("rst-badge");
				badge.text(getReasonString(userData.code));
				badge.attr('href',"javascript:;");
				$(this).append(badge);

				//if infobox is enabled, append next to name
				if(options['infobox'] == 1){
					var tooltip = $('<span></span>');
					tooltip.addClass("infobox");
					tooltip.text("Reported by: " +  userData.subreddit + "\n\r" + " Reason: " + userData.reason);
					$(this).append(tooltip);
				}
			}
		});
		$(".rst-badge").click(function(){
			//on infobox click, make it visible
			var infobox = $(this).next(".infobox");
			infobox.css("visibility", (infobox.css("visibility") == "hidden") ? "visible" : "hidden");

			//make sure that only one infobox is open
			if(lastInfoBox && !(infobox.is(lastInfoBox))){
				lastInfoBox.css("visibility", "hidden");
			}
			lastInfoBox = infobox;
		});
	});
}

function updateListJSON(callback){
	var users = [];
	Promise.all( options.banlists.map(function( v, i ) {
		return $.get( v );
	})).then(function(res) {
		$.each(res,function( i, v ){
			$.merge( users, ( getUsersFromJSON( v ) || [] ) );
		});
		//console.log(users.length);
		chrome.storage.local.set({"users": users});
		chrome.storage.local.set({"timestamp": Date.now()});
		chrome.storage.local.set({"version": version});
		//console.log("[RST] Ban List Updated!");
		if( !!callback ) {
			callback();
		}
	});
}

function getUsersFromJSON(data){
	var rx = /\*\s+\/u\/([^\s#]+)(\s+|)(#[a-z0-9]+)?/;
	if( typeof data === 'undefined' || !data.data || !data.data.content_md ) {
		return [];
	}
  var result = data.data.content_md.match( new RegExp( rx, 'gi') ) || [];
  result = result.map(function(i) {
    return i.match( new RegExp( rx, 'i' ) );
  });
  var ret = [];
  $.each(result,function(i,v){
    if( typeof v[3] === 'undefined' ) {
      v[3] = '#sketchy';
    }
    v[3] = v[3].slice(1).toLowerCase().replace('sktechy','sketchy');
    if( v[3].indexOf('ske') === 0 ) {
      v[3] = 'sketchy';
    }
    if( v[3].indexOf('spa') === 0 ) {
      v[3] = 'spammer';
    }
    if( v[3].indexOf('sca') === 0 ) {
      v[3] = 'scammer';
    }
    if( ['scammer','troll','sketchy','bot','compromised','rule','slavelabour','investigating','impersonator','spammer'].indexOf( v[3] ) === -1 ) {
      v[3] = 'sketchy';
    }
    ret.push([v[1].toLowerCase(),v[3]]);
  });
  return ret;
}

//neverending support
var pagenum = 0;
function checkForChanges() {
	if(options['neSupport'] == 1) {
		//check if a new page marker appeared
		if( !!$('.NERPageMarker') && $('.NERPageMarker').length*1) !== pagenum ){
			//set all
			pagenum = ($('.NERPageMarker').length*1);
			labelUsers();
		}
		//recheck every second
    setTimeout( checkForChanges, 1000 );
	}
	else{
		//console.log("[RST] Never Ending Support disabled! Enable it in the options!");
	}
}
function getReasonString(code){
	//translate bancode
	switch(code){
		case 1: return "SCAMMER"; break;
		case 2: return "SKETCHY"; break;
		case 3: return "TROLL"; break;
		case 4: return "COMPROMISED"; break;
		default: return "UNKNOWN"; break;
	}
}
