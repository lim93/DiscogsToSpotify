$(document).ready(function () {

    $('#login').hover(function () {
        $(this).css('cursor', 'pointer');
    });

    // Login
    $("#login").click(function () {

        var client_id = '394bdbf8b6c344c2bddb153165e00801';
        var redirect_uri = 'http://localhost:51425/export.html';
        //var redirect_uri = 'http://discogstospotify.com/export.html';

        //TODO: State

        var scope = 'playlist-modify-public playlist-modify-private user-read-private';
        var url = 'https://accounts.spotify.com/authorize';
        url += '?response_type=token';
        url += '&client_id=' + encodeURIComponent(client_id);
        url += '&scope=' + encodeURIComponent(scope);
        url += '&redirect_uri=' + encodeURIComponent(redirect_uri);
        window.location = url;


    });



});