var socket = io();

function load() {
	$("#header").css({'opacity': '0', 'margin-bottom': '36px'});
	$("#body").css({'opacity': '0'});
	$("#footer").css({'opacity': '0', 'margin-top': '36px'});
	window.setTimeout(function(){
		$("#header").css({'opacity': '1', 'margin-bottom': '0px', 'transition': 'all 1s ease'});
		$("#body").css({'opacity': '1', 'transition': 'all 1s ease'});
		$("#footer").css({'opacity': '1', 'margin-top': '0px', 'transition': 'all 1s ease'});
	}, 50);
}