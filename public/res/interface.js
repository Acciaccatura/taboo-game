//	var React = require('react');
//	var ReactDOM = require('react-dom');

var frameActive = false;
var active = false;
var name = '';
var code;
var trueCode = '';
var queue = 0;
var team;

function clicked(evn) {
	if (!frameActive) {
		frameActive = true;
		$('#body').css({'max-height': '0px', 'opacity': '0', 'transition': 'all .3s ease'});
		document.getElementById('body').addEventListener('transitionend', function clear(){
			$('#body').empty();
			var height = evn();
			document.getElementById('body').removeEventListener('transitionend', clear);
			$('#body').css({'max-height': height + 'px', 'opacity': '1', 'transition': 'all .3s ease'});
			frameActive = false;
		});
	}
}

function enterName(evn) {
	name = $('#name').val();
	if (name.length > 0 && name.length < 30) {
		$('#warn').css({'display': 'none'});
		if (evn) {
			clicked(evn);
		}
	} else {
		$('#name').focus();
		$('#warn').css({'display': 'block'});
	}
}

function createEventCode() {
	if (!active) {
		active = true;
		name = $('#name').val();
		var hex = ['0','1','2','3','4','5','6','7','8','9','a','b','c','d','e','f'];
		var line = '';
		for (var a = 0; a < 6; a++) {
			line += hex[Math.round(Math.random()*15)];
		}
		console.log('sent code ' + line);
		socket.on('message', function roomCreate(msg) {
			if (msg.type && msg.type === 'init') {
				code = msg.code;
				queue = msg.queue;
				trueCode = line;
				console.log('made a room.');
				active = false;
				clicked(multiplayer_game);
				socket.removeListener('message', roomCreate);
				console.log('this was success');
			}
		});
		socket.emit('roomCreate', {'code':line, 'name':name});
	}
}

function checkEnterCode() {
	if (!active) {
		active = true;
		var tryCode = $('#code').val();
		console.log('what? ' + tryCode);
		socket.on('message', function roomCheck(msg) {
			if (msg.type && msg.type === 'init' && msg.code >= 0) {
				code = msg.code;
				queue = msg.queue;
				trueCode = tryCode;
				clicked(multiplayer_game);
				socket.removeListener('message', roomCheck);
			} else {
				$('#warn').css({'display':'block'});
			}
		});
		socket.emit('roomCheck', {'code':tryCode, 'name':name});
		active = false;
	}
}

function sendCard(code) {
	socket.emit('sendCard', code);
}

function beginReaderTimer() {
	document.getElementById('card').setAttribute('onclick', 'sendCard(code)');
	socket.emit('startRound', code);
	sendCard(code);
	var timed = 60;
	var timer = setInterval(function(){
		timed--;
		if (timed < 0) {
			clearInterval();
			socket.emit('teamSwitch', code);
		} else
			$('#timer').html(timed);
	}, 1000);
}

function beginTimer() {
	var timed = 60;
	var timer = setInterval(function(){
		timed--;
		if (timed < 0) {
			clearInterval();
		} else
			$('#timer').html(timed);
	}, 1000);
}

function beginSynthesizeData() {
	socket.on('message', (data) => {
		console.log('rec\'d data of type ' + data.type);
		if (team != null) {
			if (data.type === 'gameData') {
				$('#game').empty();
				console.log('setup: ' + data.setup);
				if (data.setup) {
					$('#game').append('<div id="timer" style="font-size: 36px; text-align: center;">60</div>');
				}
				if (data.setup === 'guess') {
					$('#game').append('<h2>You are guessing!</h2><hr>Guess what your teammate is hinting at!');
				} else if (data.setup === 'taboo') {
					$('#game').append('<div id="card" style="border-style: solid; border-width: 1px; font-size: 20px; user-select: none;"></div><h2>You are not guessing!</h2><hr><h4>You should be checking whether or not the card reader is breaking any of the following:</h4><br><ul><li>The reader cannot say the words on the card, or any variation of them</li><li>The reader cannot make any gestures or sound effects regarding the word</li><li>The reader cannot use rhymes as a hint, or similarly spelled words</li></ul>');
				} else if (data.setup === 'reader') {
					$('#game').append('<div id="card" style="border-style: solid; border-width: 1px; font-size: 20px; height: 90%; user-select: none;" onclick="beginReaderTimer()"><div style="margin-top: 100px; font-size: 36px;">Begin!</div>');
				}
			} else if (data.type === 'cardData') {
				$('#card').html('<h5>' + data.data.word + '</h5><hr>');
				var forbid = '';
				for (var a = 0; a < data.data.forbidden.length; a++) {
					forbid += '<div>' + data.data.forbidden[a] + '</div>';
				}
				$('#card').append(forbid);
			} else if (data.type === 'end') {
				clearInterval();
				var team1 = $('#team1').html();
				var team2 = $('#team2').html();
				$('#body').empty();
				$('#body').append('<div id="teams"></div>');
				$('#body').append('<div id="game"></div>');
				$('#game').append('<h1>Waiting for Game to Start...</h1><hr>Joining afterwards!');
				$('#teams').append('<div style="margin: 0px; height: 50%; padding: 0 10px 0 10px; font-size: 16px;" id="team1">' + team1 + '</div>');
				$('#teams').append('<div style="margin: 0px; height: 50%; padding: 0 10px 0 10px; font-size: 16px;" id="team2">' + team2 + '</div>');
				console.log('finished rendering game screen');
			} else if (data.type === 'timer') {
				beginTimer();
			}
		}
		if (data.type === 'leave') {
			$('.'+ data.name.replace(/\s/g, '_')).remove();
		} else if (data.type === 'join') {
			//expected data: {String type, String name, int teamid}
			if (data.teamid === true)
					$('#team1').append("<div class=\"" + data.name.replace(/\s/g, '_') + "\">" + data.name + "</div>");
				else if (data.teamid === false)
					$('#team2').append("<div class=\"" + data.name.replace(/\s/g, '_') + "\">" + data.name + "</div>");
				else if (data.teamid == null)
					$('#lobby').append("<span class=\"" + data.name.replace(/\s/g, '_') + "\" style=\"margin: 0 20px 0 20px\">" + data.name + "</span>");
		} else if (data.type === 'getPlayers') {

		}
	});
}

function backButton(evn) {
	$('#body').append("<div style=\"font-size: 16px; text-align: center; cursor: pointer; margin-bottom: 16px;\" onclick=\"clicked(" + evn + ")\">&lt;&lt; Back</div>");
}

var opening_screen = function() {
	$('#body').append("<button type=\"button\" class=\"btn btn-default\" onclick=\"clicked(single_player)\">Single Player</button><br>");
	$('#body').append("<button type=\"button\" class=\"btn btn-default\" onclick=\"clicked(multiplayer_screen)\">Multiplayer</button>");
	return '240';
}

var multiplayer_screen = function() {
	$('#body').append("<button type=\"button\" class=\"btn btn-default\" onclick=\"clicked(multiplayer_create)\">Create Game</button><br>");
	$('#body').append("<button type=\"button\" class=\"btn btn-default\" onclick=\"clicked(multiplayer_join)\">Join an Existing Room</button>");
	backButton('opening_screen');
	return '240';
}

var multiplayer_create = function () {
	$('#body').append("<div style=\"font-size: 36px; text-align: center;\">Enter A Name:</div>");
	$('#body').append("<input type=\"text\" class=\"form-control\" style=\"width: 60%; margin: auto; text-align: center; font-size: 24px;\" id=\"name\" />");
	$('#body').append("<div style=\"font-size: 16px; color: red; display: none; width: 60%; margin: auto; text-align: left;\" id=\"warn\">Name must be between 1 and 30 characters.</div>");
	$('#body').append("<button type=\"button\" class=\"btn btn-default\" onclick=\"createEventCode();\">Continue</button>");
	backButton('multiplayer_screen');
	$('#name').focus();
	document.getElementById('name').onkeyup = function(key) {
		if (key.keyCode === 13)
			createEventCode();
	};
	return '240';
}

var multiplayer_join = function() {
	$('#body').append("<div style=\"font-size: 36px; text-align: center;\">Enter A Name:</div>");
	$('#body').append("<input type=\"text\" class=\"form-control\" style=\"width: 60%; margin: auto; text-align: center; font-size: 24px;\" id=\"name\" />");
	$('#body').append("<div style=\"font-size: 16px; color: red; display: none; width: 60%; margin: auto; text-align: left;\" id=\"warn\">Name must be between 1 and 30 characters.</div>");
	$('#body').append("<button type=\"button\" class=\"btn btn-default\" onclick=\"enterName(multiplayer_join2);\">Continue</button>");
	backButton('multiplayer_screen');
	$('#name').focus();
	document.getElementById('name').onkeyup = function(key) {
		if (key.keyCode === 13)
			enterName(multiplayer_join2);
	};
	return '240';
}

var multiplayer_join2 = function() {
	$('#body').append("<div style=\"font-size: 36px; text-align: center;\">Enter Game Code:</div>");
	$('#body').append("<input type=\"text\" class=\"form-control\" style=\"width: 240px; margin: auto; text-align: center; font-size: 24px;\" id=\"code\" maxlength=\"8\" />");
	$('#body').append("<div style=\"font-size: 16px; color: red; display: none; width: 60%; margin: auto; text-align: left;\" id=\"warn\">Room does not exist.</div>");
	$('#body').append("<button type=\"button\" class=\"btn btn-default\" onclick=\"checkEnterCode()\">Join</button>");
	backButton('multiplayer_join');
	$('#code').focus();
	document.getElementById('code').onkeyup = function(key) {
		if (key.keyCode === 13)
			checkEnterCode();
	};
	return '240';
}

var multiplayer_game = function () {
	if (!active) {
		active = true;
		socket.on('message', function createInstance(data) {
			if (data.type && data.type === 'getPlayers') {
				socket.removeListener('message', createInstance);
				beginSynthesizeData();
				console.log('data: ' + data.data[0].name);
				$('#header').append("<div style=\"font-size: 36px; text-align: center;\">Room code: " + trueCode + "</div>");
				$('#header').append("<div style=\"font-size: 24px; text-align: center;\">" + name + "</div>");
				$('#body').append("<div style=\"font-size: 16px; width: 60%; height: 480px; margin: auto; text-align: left;\" id=\"team\"></div>");
				$('#team').append("<div style=\"font-size: 32px; text-align: left;\" id=\"team1\"><h1>Team 1</h1><hr></div>");
				$('#team').append("<button type=\"button\" class=\"btn btn-default\" onclick=\"game(true)\">Join Team 1</button><br>");
				$('#team').append("<div style=\"font-size: 32px; text-align: left;\" id=\"team2\"><h1>Team 2</h1><hr></div>");
				$('#team').append("<button type=\"button\" class=\"btn btn-default\" onclick=\"game(false)\">Join Team 2</button><br>");
				$('#team').append("<div style=\"font-size: 20px; text-align: left;\" id=\"lobby\">Undecided:</div>");
				var lobby = "";
				for (var a = 0; a < data.data.length; a++) {
					if (data.data[a].teamid === true)
						$('#team1').append("<div class=\"" + data.data[a].name.replace(/\s/g, '_') + "\">" + data.data[a].name + "</div>");
					else if (data.data[a].teamid === false)
						$('#team2').append("<div class=\"" + data.data[a].name.replace(/\s/g, '_') + "\">" + data.data[a].name + "</div>");
					else if (data.data[a].teamid == null)
						$('#lobby').append("<span class=\"" + data.data[a].name.replace(/\s/g, '_') + "\" style=\"margin: 0 20px 0 20px\">" + data.data[a].name + "</span>");
				}
				active = false;
			}
		});
		socket.emit('getPlayers', code);
		return '640';
	}
}

var game = function(tfteam) {
	var team1 = $('#team1').html();
	var team2 = $('#team2').html();
	$('#body').empty();
	$('#body').append('<div id="teams"></div>');
	$('#body').append('<div id="game"></div>');
	$('#game').append('<h1>Waiting for Game to Start...</h1><hr>Joining afterwards!');
	$('#teams').append('<div style="margin: 0px; height: 50%; padding: 0 10px 0 10px; font-size: 16px;" id="team1">' + team1 + '</div>');
	$('#teams').append('<div style="margin: 0px; height: 50%; padding: 0 10px 0 10px; font-size: 16px;" id="team2">' + team2 + '</div>');
	console.log('finished rendering game screen');
	team = tfteam;
	console.log(tfteam);
	socket.emit('joinTeam', {'code': code, 'team': tfteam, 'queue': queue});
}