$(document).ready(function () {

    $('#waiting').hide();

    var params = getHashParams();
    access_token = params.access_token;

    //Set to false on page load in case the previous export didn't finish
    exportActive = false;

    // Check login state and set userID, country and userName
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
                userImageURL = '';
                userImage = '';

                if (response.images[0] != null) {
                    userImageURL = response.images[0].url;
                }

                if (userImageURL !== '') {
                    userImage = '<img src="' + userImageURL + '" style="width:25px;height:25px;float:left;display:inline;margin-right:10px;">'
                }

                if (userNameSpotify === null) {
                    $('#loggedin').html(userImage + '<p> Spotify User: ' + userID + '</p>');
                } else {
                    $('#loggedin').html(userImage + '<p> Spotify User: ' + userNameSpotify + '</p>');

                }


            },
            error: function (xhr, data) {
                window.location = "/index.html";
            }
        });
    } else {
        window.location = "/index.html";
    }

    //TODO: "None of the above"

    // Start-Button
    $("#start, #startWantlist").click(function (e) {

        //Prevent starting the export twice
        if (exportActive == true) {
            return;
        } else(exportActive = true);

        //Reset some of the global values when the start-button is clicked
        globalArtists = [];
        playlistID = null;
        multipleMatches = [];
        withoutMatches = [];
        addedCount = 0;
        totalReleases = 0;
        adedArtistCount = 0;
        totalArtists = 0;

        userNameDiscogs = $('#user').val();

        $('#imageDiv').empty();
        $('#progressDiv').removeClass('hide');
        updateProgressBar(0);

        var getWantlist = e.target.id === 'startWantlist';

        //Start after a timeout so the Browser gets time to display the changes
        setTimeout(getCollection, 10, userNameDiscogs, 1, getWantlist);


    });

    $('#start').hover(function () {
        $(this).css('cursor', 'pointer');
    });


    // Make the user choose the right release
    $('#releasesAdded').on('hidden.bs.modal', function (e) {
        exportMultipleMatches();
    });

    // And again after the modal has been hidden
    $('#bestMatch').on('hidden.bs.modal', function (e) {
        exportMultipleMatches();
    });

    // Create Playlist
    $('#collectionFetched').on('hidden.bs.modal', function (e) {
        createPlaylist();
    });

    // Set the progress bar to 100% in the end
    $('#noMatch').on('hidden.bs.modal', function (e) {
        updateProgressBar(100);
    });


});

//Currently active export?
var exportActive = false;

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

//Name of the playlist
var playlistName;

//Array of all releases with multiple matches on Spotify
var multipleMatches = [];

//Array of all releases with no match on Spotify
var withoutMatches = [];

//Count of all releases added to the Playlist
var addedCount = 0;

//How many releases are in the user's collection?
var totalReleases = 0;

//How many artists have already been saved?
var adedArtistCount = 0;

//How many artists are in the user's collection in total?
var totalArtists = 0;

//regex that checks if a release might be a two-track vinyl single
var singleTitleRegex = new RegExp(/^([^\/]*)\s\/\s[^\/]*$/);

function releaseObject(title, artistName, year) {
    this.title = title;
    this.artistName = artistName;
    this.year = year;
}

function artist(name, releases) {
    this.name = name;
    this.releases = releases;
}

function multipleMatch(release, matches, totalMatchCount) {
    this.release = release;
    this.matches = matches;
    this.totalMatchCount = totalMatchCount;
}



/** We don't want duplicate artists in the global array, so this method checks
if the array contains the given artist (by name) and returns either the position
in the array or -1. */
function artistsContainsName(name) {

    for (var i = 0; i < globalArtists.length; i++) {
        if (globalArtists[i].name === name) {
            return i;
        }
    }
    return -1;
}

/** We don't want duplicate releases per artist (user could own
more than one copy of a release, e.g. CD and vinyl) */
function releasesContainsTitle(releases, title) {

    for (var i = 0; i < releases.length; i++) {
        if (releases[i].title === title) {
            return true;
        }
    }
    return false;
}

/** Update the progressbar to the given number in percent */
function updateProgressBar(percent) {

    percent = Math.round(percent);

    $('.progress-bar').css('width', percent + '%').attr('aria-valuenow', percent);
    $('#progressNumber').html(percent + '%');
}


/** Entry point. Fetches the user's collection from Discogs */
function getCollection(userName, page, getWantlist) {

    $('#waiting').hide();

    var folderId = 0;

    var collectionURLsegment = getWantlist ? '/wants' : '/collection/folders/' + folderId + '/releases';
    var url = 'https://api.discogs.com/users/' + userName + collectionURLsegment + '?page=' + page + '&per_page=100'

    $.ajax({
        url: url,
        type: "GET",
        crossDomain: true,
        data: {
            sort: "artist",
            sort_order: "asc"
        },
        success: function (result) {

            addArtistsAndReleases(result);

            var currentPage = result.pagination.page;
            var pages = result.pagination.pages;

            //next page
            if (currentPage < pages) {

                var currentProgress = (currentPage / pages) * 20;
                updateProgressBar(currentProgress);

                var nextPage = currentPage + 1;

                //Continue after a timeout so the progress gets updated
                setTimeout(getCollection, 500, userName, nextPage, getWantlist);

            } else {

                //When all pages are loaded, the progress must be 20%
                updateProgressBar(20);

                var playlistStr = getWantlist ? "Wantlist" : "Collection";

                if (userNameDiscogs.match(/s$/) == 's') {
                    playlistName = userNameDiscogs + " Discogs " + playlistStr;
                } else {
                    playlistName = userNameDiscogs + "'s Discogs " + playlistStr;
                }

                $('#collectionFetchedText').html('We fetched a total of ' + totalReleases + ' releases from your ' + playlistStr + '.<br /><br />For the next step, we will create the playlist "' + playlistName + '" in your Spotify account and start filling it with the releases from your collection.');
                $("#collectionFetched").modal('show');
            }

        },
        error: function (xhr, data) {

            if (xhr.status == 404) {
                $('#errorModalText').html("Unknown Discogs username. Please try again.");
                $("#errorModal").modal('show');
            } else if (xhr.status == 0) {

                $('#waiting').show();

                //Wait a 'few' seconds, then try again
                setTimeout(getCollection, 61000, userName, page);
            } else if (xhr.status == 401) {
                $('#errorModalText').html("We couldn't fetch your collection from Discogs. Please go to your Discogs <a href='https://www.discogs.com/settings/privacy'>Privacy Settings</a> and make sure that you allow others to browse your collection.");
                $("#errorModal").modal('show');

            } else {
                $('#errorModalText').html("Something went wrong while fetching your collection: " + xhr.status + ". Please try again.");
                $("#errorModal").modal('show');
            }
        }
    });


}

/** Takes the result from Discogs and adds each artist and their releases to the global array (No duplicates!) */
function addArtistsAndReleases(result) {

    var releases = result.releases || result.wants;

    $.each(releases, function (pos, release) {

        var releaseTitle = release.basic_information.title;
        var releaseYear = release.basic_information.year;
        var releaseArtists = release.basic_information.artists;
        var releaseArtistName = releaseArtists[0].name;

        //Some artists on Discogs have a number in closing round parenthesis behing their name. We don't want these.
        var splitName = releaseArtistName.split(/([(]\d+[)].*)/);
        var artistName = splitName[0].trim();

        var thisRelease = new releaseObject(releaseTitle, artistName, releaseYear);

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
            totalArtists++;

        }

    });
}


function encodeURIfix(str) {
    return encodeURIComponent(str).replace(/!/g, '%21');
}


/** Creates a new playlist in the user's Spotify account, using the Discogs username */
function createPlaylist() {

    $.ajax({
        url: 'https://api.spotify.com/v1/users/' + encodeURIfix(userID) + '/playlists',
        headers: {
            'Authorization': 'Bearer ' + access_token
        },
        data: JSON.stringify({
            "name": playlistName,
            "public": true

        }),
        type: "POST",
        contentType: "application/json; charset=utf-8",
        dataType: 'json',
        success: function (result) {
            playlistID = result.id;

            updateProgressBar(20);

            exportToSpotify();

        },
        error: function (request, xhr, data) {
            errorJSON = request.responseJSON;
            message = errorJSON.error.message;

            $('#errorModalText').html("Something went wrong while creating a Spotify playlist: " + xhr.status + ". Please try again. (" + message + ")");
            $("#errorModal").modal('show');

        }
    });

}



/** Gets the next artist from the global array and exports the artist's releases to Spotify */
function exportToSpotify() {

    if (globalArtists.length > 0) {

        var artist = globalArtists[0];
        globalArtists.splice(0, 1);

        var releases = artist.releases;

        $.each(releases, function (pos, release) {

            searchReleaseOnSpotify(release);

        });

        adedArtistCount++;

        //Update Progress AND export next artist
        updateProgress();

    } else {

        $('#releasesAddedText').empty();
        $('#releasesAddedText').append(addedCount + " releases were already added to your Spotify playlist automatically. ");

        if (multipleMatches.length === 1) {
            $('#releasesAddedText').append("For the next release, we will need a little help from you.");
        } else if (multipleMatches.length >= 1) {
            $('#releasesAddedText').append("For the following " + multipleMatches.length + " releases, we will need a little help from you.");
        }

        $("#releasesAdded").modal('show');

    }

}


/** Helper function that calculates the progress based on the number of already exported artists and then
 * sets a timeout until the next *artist gets exported. This leaves time for the browser to display the updated
 * progress bar and the cover images */
function updateProgress() {

    //Progress bar is at 20% before the first artist is exported and should be at 70% after the last one
    var progress = ((adedArtistCount / totalArtists) * 100 / 2) + 20;
    updateProgressBar(progress);

    // next artist
    setTimeout(exportToSpotify, 100);

}


/** If there are releases with multiple possible matches, we display a modal to make the user decide
 * which is the right one */
function exportMultipleMatches() {

    if (multipleMatches.length > 0) {

        var match = multipleMatches[0];

        multipleMatches.splice(0, 1);

        $('#bestMatchHeader').empty();
        $('#bestMatchDetails').empty();
        $('#spotifyDiv').empty();

        var release = match.release;
        var yearString = (release.year != 0) ? " (" + release.year + ")" : "";


        $('#bestMatchHeader').html("<h4 class='modal-title'>Choose the best match for <b>" + release.title + "</b> by " + release.artistName + yearString + "</h4>");
        var matchDetails = 'There are ' + match.totalMatchCount + ' possible matches on Spotify. ';
        var searchLimit = 50;
        if (match.totalMatchCount > searchLimit) {
            matchDetails = matchDetails.concat('Here are the first ' + searchLimit + '. ');
        }
        matchDetails = matchDetails.concat('Please choose from the list below:');
        $('#bestMatchDetails').html(matchDetails);

        var matches = match.matches;

        $.each(matches, function (pos, album) {

            var name = album.name;
            var albumID = album.id;
            var imageURL = '../record.png';

            if (album.images.length !== 0) {
                imageURL = album.images[0].url;
            }

            $('#spotifyDiv').append('<div><img src="' + imageURL + '" width="20%" style="display:inline-block; margin:10px; vertical-align:top"><div style="display:inline-block; width:70%"><h4>' + name + '</h4><button id="' + albumID + ' ' + imageURL + '" type="button" class="btn btn-success" onClick = "saveAlbumFromMulti(this.id)"><span class="icon-checkmark"></span> Choose this</button></div></div>');

        });

        $('#noMatchButton').html('<span class="icon-cancel-circle"></span> None of the above');

        $("#bestMatch").modal('show');

    } else {
        updateProgressBar(90);
        showNoMatch();
    }

}


/** Reacts to the button in the modal and saves the chosen release to the playlist */
function saveAlbumFromMulti(idAndURL) {

    $("#bestMatch").modal('hide');

    var seperated = idAndURL.split(" ");

    saveAlbumToPlaylist(seperated[0], seperated[1]);

}


/** Displays the modal with all releases without a match on Spotify. End of the export. */
function showNoMatch() {

    $('#noMatchDiv').empty();

    if (withoutMatches.length > 0) {

        $('#noMatchDiv').append("<ul>");

        $.each(withoutMatches, function (pos, release) {

            $('#noMatchDiv').append("<li><b>" + release.artistName + "</b>: " + release.title + " (" + release.year + ")" + "  </li>")
        });

        $('#noMatchDiv').append("</ul>");

        $("#noMatch").modal('show');
        exportActive = false;

    }

}


/** Start a search on Spotify and handle the result */
function searchReleaseOnSpotify(release) {

    var rArtist = release.artistName;
    if (rArtist) {
        rArtist = stripSingleQuotes(rArtist);
    }
    var rTitle = release.title;
    var formatSuffixes = ['EP', 'E.P.', 'E.P', 'LP', 'L.P.',' L.P'];

    if (rTitle) {
        rTitle = stripSingleQuotes(rTitle);
        rTitle = stripBSide(rTitle);
        for (var i = 0; i < formatSuffixes.length; i++) {
            // ensure there is a leading space, so that potential acronym titles ("W.E.L.P.") do not get filtered out
            // this also prevents issues with releases such as "L.P." by "The Rembrandts"
            if (rTitle.endsWith(' ' + formatSuffixes[i])) {
                rTitle = rTitle.slice(0, -formatSuffixes[i].length).trim();
                break;
            }
        }
    }


    var query = 'album:"' + rTitle + '" artist:"' + rArtist + '"';

    $.ajax({
        url: 'https://api.spotify.com/v1/search',
        headers: {
            'Authorization': 'Bearer ' + access_token
        },
        data: {
            q: query,
            type: 'album',
            market: userCountry,
            limit: 50
        },
        type: "GET",
        success: function (result) {

            handleResultFromSpotify(result, release);
        },
        error: function (request, xhr, data) {

            if (data === "Too Many Requests"  || data === "Bad Gateway") {

                //Wait a few seconds, then try again
                setTimeout(searchReleaseOnSpotify, 2000, release);
            } else {

                $('#errorModalText').html("Something went wrong while searching on Spotify: " + data + ". Please try again.");
                $("#errorModal").modal('show');
            }
        },
        async: false
    });
}


/** Decides if any album from the Spotify-result is a perfect match for the given release,
 * or if the user has to choose the right one manually */
function handleResultFromSpotify(result, release) {

    //Possible matches
    var items = result.albums.items;
    var total = result.albums.total;

    //nothing found
    if (total === 0) {
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
            var imageURL = '../record.png';

            if (album.images.length !== 0) {
                imageURL = album.images[0].url;
            }

            saveAlbumToPlaylist(albumID, imageURL);

            return;
        }
    });

    //One and only match - hope it's the right one
    if (!done && total === 1) {

        done = true;
        var album = items[0];

        var albumID = album.id;
        var imageURL = '../record.png';

        if (album.images.length !== 0) {
            imageURL = album.images[0].url;
        }

        saveAlbumToPlaylist(albumID, imageURL);

        return;
    }

    //More than one possible match - let the user decide
    if (!done && total > 1) {

        var m = new multipleMatch(release, items, total);
        multipleMatches.push(m);

        done = true;
        return;
    }

}

/** Gets an album's tracks and has them saved to the playlist. Adds the cover to the site */
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

            saveAlbumTracks(result);

            $('<img src="' + imageURL + '">').load(function () {
                $(this).width('15%').css("margin", "2.5%").appendTo($('#imageDiv'));
            });

        },
        error: function (request, xhr, data) {

            if (data === "Too Many Requests"  || data === "Bad Gateway") {

                //Wait a few seconds, then try again
                setTimeout(saveAlbumToPlaylist, 2000, albumID, imageURL);
            } else {

                $('#errorModalText').html("Something went wrong while getting the album tracks: " + data + ". Please try again.");
                $("#errorModal").modal('show');
            }


        },
        async: false
    });

}

/** Saves tracks to the playlist */
function saveAlbumTracks(tracks) {

    var spotifyURIs = [];

    $.each(tracks.items, function (pos, item) {
        spotifyURIs.push(item.uri);
    });

    return $.ajax({
        url: 'https://api.spotify.com/v1/users/' + encodeURIfix(userID) + '/playlists/' + playlistID + '/tracks',
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

            if (data === "Too Many Requests" || data === "Bad Gateway") {

                //Wait a few seconds, then try again
                setTimeout(saveAlbumTracks, 2000, tracks);
            } else {

                $('#errorModalText').html("Something went wrong while saving the tracks to your playlist: " + data + ". Please try again.");
                $("#errorModal").modal('show');
            }



        },
        async: false
    });
}

/** checks if the release is most likely a single, if so, it returns only the a side title */
function stripBSide(string) {
    var couldBeASingle = singleTitleRegex.test(string);
    if (couldBeASingle === false) {
        return string;
    }
    var strippedString = singleTitleRegex.exec(string)[1].trim();
    return strippedString;
}

/** strips single quotes because Spotify's search cannot consistently handle them */
function stripSingleQuotes(string) {
    var strippedString = string.replace(/(\w)('\w')(\w)/g, '$1 $2 $3'); // Twists'n'Turns => Twists 'n' Turns;
    strippedString = strippedString.replace(/'/g, '')
    return strippedString;
}

/** Gets parameters from the hash of the URL */
function getHashParams() {
    var hashParams = {};
    var e, r = /([^&;=]+)=?([^&;]*)/g,
        q = window.location.hash.substring(1);
    while (e = r.exec(q)) {
        hashParams[e[1]] = decodeURIComponent(e[2]);
    }
    return hashParams;
}