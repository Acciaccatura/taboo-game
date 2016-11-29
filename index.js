var express = require('express');
var app = express();
var http = require('http').Server(app);
var sio = require('socket.io')(http);
var fs = require('fs');

var activeRooms = [];
var cards = JSON.parse(fs.readFileSync('cards.json', 'utf8'));
//{code: x, memb: y, team1, team2, lobby, turn(1 = true, 2 = false), reader, card};

app.use(express.static(__dirname + '/public/'));

function getRoom(roomNo) {
	var check = Math.round(parseInt(roomNo.substring(0, 4), 16)/2);
	while(activeRooms[check] != null && activeRooms[check].code != roomNo) {
		check++;
	}
	if (activeRooms[check] != null) {
		return check;
	} else return -1;
}

//addRoom(String hex, Socket socket)
function addRoom(roomNo, socket) {
	var check = Math.round(parseInt(roomNo.substring(0, 4), 16)/2);
	while(activeRooms[check] != null)
		check++;
	activeRooms[check] = {'code':roomNo, 'memb': 0, 'queue': [], 'squeue': [], 'turn': true, 'team1': 0, 'team2': 0, 'reader': -1, 'card': 0};
	return check;
}

//addSocketToRoom(int roomNo(exact), Socket socket)
function addSocketToRoom(roomNo, socket) {
	activeRooms[roomNo].memb++;
	var a = 0;
	while (activeRooms[roomNo].queue[a] != null) {
		a++;
	}
	activeRooms[roomNo].queue[a] = {'name': socket.name, 'teamid': null};
	activeRooms[roomNo].squeue[a] = socket;
	socket.room = roomNo;
	socket.queue = a;
	sendToServer(socket.room, {'type': 'join', 'name': socket.name, 'teamid': null});
	return a;
}

//sendToServer(int roomNo(exact), Object data, Socket except);
function sendToServer(roomNo, data) {
	var members = activeRooms[roomNo].squeue;
	for (var a = 0; a < members.length; a++) {
		if (members[a] != null) {
			members[a].send(data);
		}
	}
}

//AUXILLARY FUNCTIONS

//teamSwitch(code(exact))
function teamSwitch (data) {
	console.log(data);
	console.log(activeRooms[data]);
	console.log(activeRooms[data].turn);
	activeRooms[data].turn = !(activeRooms[data].turn);
	var turn = activeRooms[data].turn;
	var qlen = activeRooms[data].queue.length;
	var a = ++activeRooms[data].reader;
	while (activeRooms[data].queue[a] == null) {
		a++;
		if (a >= qlen)
			a = 0;
	}
	while (activeRooms[data].queue[a].teamid === turn && a != activeRooms[data].reader) {
		a++;
		while (activeRooms[data].queue[a] == null && a < qlen)
			a++;
		if (a >= qlen)
			a = 0;
	}
	console.log('surpassedLoop with a = ' + a);
	activeRooms[data].reader = a;
	activeRooms[data].squeue[a].send({'type': 'gameData', 'setup': 'reader'});
	for (var a = 0; a < activeRooms[data].queue.length; a++) {
		if (activeRooms[data].queue[a] != null && activeRooms[data].reader != a) {
			console.log('surpassedInnerLoop with value = ' + activeRooms[data].queue[a].teamid);
			if (activeRooms[data].queue[a].teamid === !turn) {
				console.log('sent something!');
				activeRooms[data].squeue[a].send({'type': 'gameData', 'setup': 'guess'});
			} else if (activeRooms[data].queue[a].teamid === turn) {
				console.log('sent something!');
				activeRooms[data].squeue[a].send({'type': 'gameData', 'setup': 'taboo'});
			}
		}
	}
}

//sendCard(code(exact))
function sendCard(data){
	console.log('performing sendCard');
	var members = activeRooms[data].squeue;
	var members1 = activeRooms[data].queue;
	var sendNumb = Math.floor(Math.random()*cards.length);
	for (var a = 0; a < members.length; a++) {
		if (members[a] != null && members1[a].teamid === activeRooms[data].turn) {
			members[a].send({'type': 'cardData', 'data': cards[sendNumb]});
			console.log('sent to ' + members[a].id);
		}
	}
	activeRooms[data].squeue[activeRooms[data].reader].send({'type': 'cardData', 'data': cards[sendNumb]});
	console.log('sent to reader: ' + activeRooms[data].squeue[activeRooms[data].reader].id);
}

//stopGame(code(exact))
function endGame(data){
	sendToServer(data, {'type': 'end'});
}

//END AUXILLARY FUNCTIONS

sio.on('connection', (socket) => {
	console.log(socket.id);
	socket.on('roomCheck', (data) => {
		socket.name = data.name;
		var get = getRoom(data.code);
		if (get >= 0) {
			var a = addSocketToRoom(get, socket);
			socket.send({'type': 'init', 'code':get, 'queue':a});
		} else {
			socket.send(-1);
		}
	});

	socket.on('roomCreate', (data) => {
		socket.name = data.name;
		var room = addRoom(data.code);
		var a = addSocketToRoom(room, socket);
		socket.send({'type': 'init', 'code':room, 'queue': a});
	});
	
	//GAME
	
	//getTeams (code(exact))
	//	returns {Array members}
	socket.on('getPlayers', function(data) {
		socket.send({'type':'getPlayers', 'data': activeRooms[data].queue});
	});
	
	//joinTeam ({code(exact), team})
	socket.on('joinTeam', function(data) {
		activeRooms[data.code].queue[data.queue].teamid = data.team;
		var teamy = null;
		if (data.team) {
			if (activeRooms[data.code].team1 === 1 && activeRooms[data.code].team2 > 1)
				teamSwitch(data.code);
			activeRooms[data.code].team1++;
			teamy = true;
		} else {
			if (activeRooms[data.code].team2 === 1 && activeRooms[data.code].team1 > 1)
				teamSwitch(data.code);
			activeRooms[data.code].team2++;
			teamy = false;
		}
		sendToServer(data.code, {'type': 'leave', 'name': socket.name});
		sendToServer(data.code, {'type': 'join', 'name': socket.name, 'teamid': teamy});
	});
	
	//teamSwitch ({code(exact)})
	socket.on('teamSwitch', function(data){
		teamSwitch(data);
	});
	
	//sendCard(code(exact))
	socket.on('sendCard', function(data) {
		sendCard(data);
	});
	
	//startRound(code(exact))
	socket.on('startRound', function(data) {
		sendToServer(data, {'type': 'timer'});
	});
	//
	
	socket.on('disconnect', function(){
		console.log('what?---------------------------------------------');
		if (socket.room) {
			if (activeRooms[socket.room].queue[socket.queue].teamid === true)
				activeRooms[socket.room].team1--;
			else if (activeRooms[socket.room].queue[socket.queue].teamid === false)
				activeRooms[socket.room].team2--; 
			activeRooms[socket.room].queue[socket.queue] = null;
			activeRooms[socket.room].squeue[socket.queue] = null;
			sendToServer(socket.room, {'type': 'leave', 'name': socket.name});
			if (--activeRooms[socket.room].memb <= 0) {
				console.log('room removed!');
				activeRooms[socket.room] = null;
			} else if (activeRooms[socket.room].team1 < 2 || activeRooms[socket.room].team2 < 2) {
				endGame(socket.room);
			} else if (activeRooms[socket.room].reader === socket.queue) {
				var a = ++activeRooms[data].reader;
				while (activeRooms[data].queue[a].teamid === turn && a != activeRooms[data].reader) {
					a++;
					while (activeRooms[data].queue[a] == null && a < qlen)
						a++;
					if (a >= qlen)
						a = 0;
				}
				activeRooms[data].reader = a;
				activeRooms[data].squeue[a].send({'type': 'gameData', 'setup': 'reader'});
			}
		}
	});
});

var port = process.env.PORT || 3000;
var ip = process.env.IP || '0.0.0.0';
http.listen(port, ip, function(){
	console.log('Listening on ' + port);
})