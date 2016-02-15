$(document).ready(function () {

    var params = getHashParams();
    access_token = params.access_token;


    if (access_token) {
        $.ajax({
            url: 'https://api.spotify.com/v1/me',
            headers: {
                'Authorization': 'Bearer ' + access_token
            },
            success: function (response) {

                $('#login').hide();
                $('#loggedin').show();

                userID = response.id;
                userCountry = response.country;
                userNameSpotify = response.display_name;

                $('#loggedin').html('<p>Logged in as ' + userNameSpotify + '</p>');
            },
            error: function (xhr, data) {
                window.location = "/login.html";
            }
        });
    } else {
        window.location = "/login.html";
    }



    // Start-Button
    $("#start").click(function () {

        //New instance every time the start-button is clicked 
        globalArtists = new Array();
        loopCounter = 0;

        //TODO Reset everything

        userNameDiscogs = $('#user').val();

        getCollection(userNameDiscogs, 1);


    });

    $('#start').hover(function () {
        $(this).css('cursor', 'pointer');
    });


    // BeginExport-Button
    $('#playlistCreated').on('hidden.bs.modal', function (e) {
        exportToSpotify();
    })

    // BeginExport-Button
    $('#releasesAdded').on('hidden.bs.modal', function (e) {
        exportMultipleMatches();
    })



    // var progress = (addedCount / totalReleases) * 100;

    // $('.progress-bar').css('width', progress + '%').attr('aria-valuenow', progress);



});

//Global access_token for Spotify
var access_token;

//Global Array with all artists and their releases
var globalArtists;

//Spotify user_id
var userID;

//Spotify country
var userCountry;

//Spotify display_name
var userNameSpotify;

//Discogs UserName
var userNameDiscogs;

//Spotify playlist_id
var playlistID;

//Array of all releases with multiple matches on Spotify
var multipleMatches = [];

//Array of all releases with no match on Spotify
var withoutMatches = [];

//Count of all releases added to the Playlist
var addedCount = 0;

var totalReleases = 0;




function releaseObject(title, artistName, year) {
    this.title = title;
    this.artistName = artistName;
    this.year = year;
    this.image = null;
    this.spotifyId = null;
}

function artist(name, releases) {
    this.name = name;
    this.releases = releases;
}

function playlist(name, public) {
    this.name = name;
    this.public = public;
}


function multipleMatch(release, matches) {
    this.reslease = release;
    this.matches = matches;
}



//We don't want duplicate artists in the global array, so this method checks if the array contains the given artist (by name) and returns either the position in the array or -1. 
function artistsContainsName(name) {

    for (var i = 0; i < globalArtists.length; i++) {
        if (globalArtists[i].name === name) {
            return i;
        }

    }

    return -1;
}

//We don't want duplicate releases per artist (user could own
//more than one copy of a release, e.g. CD and vinyl)
function releasesContainsTitle(releases, title) {

    for (var i = 0; i < releases.length; i++) {
        if (releases[i].title === title) {
            return true;
        }

    }

    return false;

}






function getCollection(userName, page) {

    var folderId = 0;

    $.ajax({
        url: 'https://api.discogs.com/users/' + userName + '/collection/folders/' + folderId + '/releases?page=' + page,
        type: "GET",
        beforeSend: function (xhr) {
            //xhr.setRequestHeader('User-Agent', 'DiscogsToSpotify');
        },
        success: function (result) {

            mapArtistsAndReleases(result);

            //next page
            if (result.pagination.page < result.pagination.pages) {

                var nextPage = result.pagination.page + 1;
                getCollection(userName, nextPage);

            } else {

                createPlaylist();

            }



        },
        error: function (xhr, data) {

            if (xhr.status == 404) {
                alert("Unknown Username. Discogs API returned 404.");
            } else {
                alert("Error: HTTP " + xhr.status);
            }


        }
    });


}

function mapArtistsAndReleases(result) {

    $.each(result.releases, function (pos, release) {

        var releaseTitle = release.basic_information.title;
        var releaseYear = release.basic_information.year;
        var releaseArtists = release.basic_information.artists;
        var releaseArtistName = releaseArtists[0].name;

        var thisRelease = new releaseObject(releaseTitle, releaseArtistName, releaseYear);

        var positionInGlobalArray = artistsContainsName(releaseArtistName);

        if (positionInGlobalArray != -1) {

            //Get the artist from the global array
            var thisArtist = globalArtists[positionInGlobalArray];

            //Add this release to the artist's releases, if it's not in the array already
            if (!releasesContainsTitle(thisArtist.releases, thisRelease.title)) {
                thisArtist.releases.push(thisRelease);
                totalReleases++;
            }

        } else {

            //Create new artist with new release-array and add artist to the global array      
            globalArtists.push(new artist(releaseArtistName, new Array(thisRelease)));
            totalReleases++;

        }

    });


}

function createPlaylist() {

    var name = userNameDiscogs + "'s Discogs Collection";

    $.ajax({
        url: 'https://api.spotify.com/v1/users/' + userID + '/playlists',
        headers: {
            'Authorization': 'Bearer ' + access_token
        },
        data: JSON.stringify({
            "name": name,
            "public": true

        }),
        type: "POST",
        contentType: "application/json; charset=utf-8",
        dataType: 'json',
        success: function (result) {
            playlistID = result.id;

            var playListCreatedText = "New empty playlist '" + name + "' created in your Spotify account.";
            $('#playlistCreatedText').html(playListCreatedText);

            $("#playlistCreated").modal('show');

        },
        error: function (request, xhr, data) {

            alert("Error: HTTP " + xhr.status);

        }
    });

}




function exportToSpotify() {

    $.each(globalArtists, function (pos, artist) {

        var releases = artist.releases;

        $.each(releases, function (pos, release) {

            searchReleaseOnSpotify(release);

        });

    });

    $('#releasesAddedText').append(addedCount + " releases were already added to your Spotify playlist automatically. ");

    if (multipleMatches.length > 0) {
        $('#releasesAddedText').append("For the following " + multipleMatches.length + " releases, we will need a little help from you.");
    }

    $("#releasesAdded").modal('show');

}



function exportMultipleMatches() {

    if (multipleMatches.length > 0) {

        var match = multipleMatches[0];

        multipleMatches.splice(0, 1);

        $('#bestMatchHeader').empty();
        $('#spotifyDiv').empty();

        var release = match.reslease;

        $('#bestMatchHeader').html("<h4 class='modal-title'>Choose the best match for <b>" + release.title + "</b> by " + release.artistName + " (" + release.year + ")" + "</h4>");

        var matches = match.matches;


        $.each(matches, function (pos, album) {

            var name = album.name;
            var albumID = album.id;
            var imageURL = album.images[0].url;

            $('#spotifyDiv').append('<div><img src="' + imageURL + '" width="20%" style="display:inline-block; margin:10px; vertical-align:top"><div style="display:inline-block; width:70%"><h4>' + album.name + '</h4><button id="' + albumID + ' ' + imageURL + '" type="button" class="btn btn-default" onClick = "saveAlbumFromMulti(this.id)">Choose this</button></div></div>');

        });


        $("#bestMatch").modal('show');

    } else {
        showNoMatch();
    }

}

function saveAlbumFromMulti(idAndURL) {

    $("#bestMatch").modal('hide');
    $('.modal-backdrop').remove();

    var seperated = idAndURL.split(" ");

    saveAlbumToPlaylist(seperated[0], seperated[1]);

    exportMultipleMatches();
}


function showNoMatch() {

    if (withoutMatches.length > 0) {

        $('#noMatchDiv').append("<ul>");

        $.each(withoutMatches, function (pos, release) {

            $('#noMatchDiv').append("<li><b>" + release.artistName + "</b>: " + release.title + " (" + release.year + ")" + "  </li>")
        });

        $('#noMatchDiv').append("</ul>");


        $("#noMatch").modal('show');


    }


}





function searchReleaseOnSpotify(release) {

    var query = 'album:' + release.title + ' artist:' + release.artistName;

    $.ajax({
        url: 'https://api.spotify.com/v1/search',
        headers: {
            'Authorization': 'Bearer ' + access_token
        },
        data: {
            q: query,
            type: 'album',
            market: userCountry
        },
        type: "GET",
        success: function (result) {

            //alert('Searched Spotify for ' + release.title);
            handleResultFromSpotify(result, release);
        },
        error: function (request, xhr, data) {

            //Todo           

        },
        async: false
    });
}


function handleResultFromSpotify(result, release) {

    //Possible matches
    var items = result.albums.items;


    //nothing found
    if (items.length === 0) {
        withoutMatches.push(release);
        return;
    }

    var done = false;


    //Loop to find exact matches
    $.each(items, function (pos, album) {

        var name = album.name;


        //exact match 
        if (!done && name.toLowerCase() === release.title.toLowerCase()) {

            done = true;

            var albumID = album.id;
            var imageURL = album.images[0].url;

            saveAlbumToPlaylist(albumID, imageURL);

            return;
        }
    });


    //More than one possible match
    if (!done && items.length > 1) {

        var m = new multipleMatch(release, items);
        multipleMatches.push(m);

        done = true;
        return;
    }



    //            //one and only match
    //            if (items.length === 1) {
    //    
    //                var name = items[0].name;
    //                var nameTLC = name.toLowerCase();
    //    
    //                if (nameTLC.indexOf("version") > -1) {
    //                    $('#matchDiv').append('<li>One And Only: ' + name + '</li>');
    //                    return;
    //                }
    //    
    //                if (nameTLC.indexOf("delux") > -1) {
    //                    $('#matchDiv').append('<li>One And Only: ' + name + '</li>');
    //                    return;
    //                }
    //    
    //    
    //                if (nameTLC.indexOf("edition") > -1) {
    //                    $('#matchDiv').append('<li>One And Only: ' + name + '</li>');
    //                    return;
    //                }
    //    
    //    
    //                $('#unclearDiv').append('<li>Might be: ' + name + '</li>');
    //                return;
    //            }


}


function saveAlbumToPlaylist(albumID, imageURL) {

    return $.ajax({
        url: 'https://api.spotify.com/v1/albums/' + albumID + '/tracks',
        headers: {
            'Authorization': 'Bearer ' + access_token
        },
        data: {
            market: userCountry
        },
        type: "GET",
        success: function (result) {

            addImage(imageURL, $('#matchDiv'));
            saveAlbumTracks(result);

        },
        error: function (request, xhr, data) {
            alert("error");
        },
        async: false
    });






}

function saveAlbumTracks(tracks) {

    var spotifyURIs = [];

    $.each(tracks.items, function (pos, item) {
        spotifyURIs.push(item.uri);
    });

    return $.ajax({
        url: 'https://api.spotify.com/v1/users/' + userID + '/playlists/' + playlistID + '/tracks',
        headers: {
            'Authorization': 'Bearer ' + access_token
        },
        data: JSON.stringify({
            "uris": spotifyURIs
        }),
        type: "POST",
        contentType: "application/json; charset=utf-8",
        dataType: 'json',
        success: function (result) {
            addedCount++;

        },
        error: function (request, xhr, data) {

            alert("Error: HTTP " + xhr.status);

        },
        async: false
    });
}


function addImage(imageURL, element) {

    $('<img src="' + imageURL + '">').load(function () {
        $(this).width('15%').css("margin", "2.5%").appendTo(element);
    });

}


/**
 * Obtains parameters from the hash of the URL
 * @return Object
 */
function getHashParams() {
    var hashParams = {};
    var e, r = /([^&;=]+)=?([^&;]*)/g,
        q = window.location.hash.substring(1);
    while (e = r.exec(q)) {
        hashParams[e[1]] = decodeURIComponent(e[2]);
    }
    return hashParams;
}