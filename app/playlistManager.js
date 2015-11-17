var libQ = require('kew');
var libFast = require('fast.js');
var fs=require('fs-extra');
var S = require('string');

module.exports = PlaylistManager;

function PlaylistManager(commandRouter) {
	var self = this;

	self.commandRouter=commandRouter;

	self.playlistFolder='/data/playlist/';
	self.favouritesPlaylistFolder='/data/favourites/';

	fs.ensureDirSync(self.playlistFolder);
	fs.ensureDirSync(self.favouritesPlaylistFolder);
}

PlaylistManager.prototype.createPlaylist = function(name) {
	var self = this;

	var defer=libQ.defer();

	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'Creating playlist '+name);

	var playlist=[];
	var filePath=self.playlistFolder+name;

	fs.exists(filePath, function (exists) {
		if(exists)
			defer.resolve({success:false,reason:'Playlist already exists'});
		else
		{
			fs.writeJson(filePath,playlist, function (err) {
				if(err)
					defer.resolve({success:false});
				else defer.resolve({success:true});
			});
		}

	});

	return defer.promise;
}

PlaylistManager.prototype.deletePlaylist = function(name) {
	var self = this;

	var defer=libQ.defer();

	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'Deleting playlist '+name);

	var playlist=[];
	var filePath=self.playlistFolder+name;

	fs.exists(filePath, function (exists) {
		if(!exists)
			defer.resolve({success:false,reason:'Playlist does not exist'});
		else
		{
			fs.unlink(filePath, function (err) {
				if(err)
					defer.resolve({success:false});
				else defer.resolve({success:true});
			});
		}

	});

	return defer.promise;
}

PlaylistManager.prototype.listPlaylist = function() {
	var self = this;

	var defer=libQ.defer();

	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'Listing playlists');

	var playlists=[];

	var folderContents=fs.readdirSync(self.playlistFolder);
	for(var j in folderContents)
	{
		var fileName=folderContents[j];
		playlists.push(fileName);
	}

	defer.resolve(playlists);

	return defer.promise;
}

PlaylistManager.prototype.getPlaylistContent = function(name) {
	var self = this;

	return self.commonGetPlaylistContent(self.playlistFolder,name);
}

PlaylistManager.prototype.addToPlaylist = function(name,service,uri) {
	var self = this;

	//self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'Adding uri '+uri+' to playlist '+name);
	self.commandRouter.pushToastMessage('success',"Added", uri+' to playlist '+name);
	return self.commonAddToPlaylist(self.playlistFolder,name,service,uri);
}


PlaylistManager.prototype.removeFromPlaylist = function(name,service,uri) {
	var self = this;

	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'Removing uri '+uri+' to playlist '+name);

	return self.commonRemoveFromPlaylist(self.playlistFolder,name,service,uri);
}

PlaylistManager.prototype.playPlaylist = function(name) {
	var self = this;

	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'Play playlist '+name);

	return self.commonPlayPlaylist(self.playlistFolder,name);
}

PlaylistManager.prototype.enqueue = function(name) {
	var self = this;

	var defer=libQ.defer();

	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'Enqueue '+name);

	var filePath=self.playlistFolder+name;

	fs.exists(filePath, function (exists) {
		if(!exists)
			defer.resolve({success:false,reason:'Playlist does not exist'});
		else
		{
			fs.readJson(filePath, function (err, data) {
				if(err)
					defer.resolve({success:false});
				else
				{
					var promises=[];
					var promise;

					for(var i in data)
					{
						promise=self.commandRouter.executeOnPlugin('music_service', 'mpd', 'add', data[i].uri);
						promises.push(promise);
					}

					libQ.all(promises)
						.then(function(data){
							defer.resolve({success:true});
						})
						.fail(function (e) {
							defer.resolve({success:false,reason:e});
						});



				}
			});
		}

	});

	return defer.promise;
}

// Favourites
PlaylistManager.prototype.getFavouritesContent = function(name) {
	var self = this;

	return self.commonGetPlaylistContent(self.favouritesPlaylistFolder,'favourites');
}

PlaylistManager.prototype.addToFavourites = function(service,uri) {
	var self = this;

	self.commandRouter.pushToastMessage('success',"Added", uri+' to Favourites ');

	return self.commonAddToPlaylist(self.favouritesPlaylistFolder,'favourites',service,uri);
}

PlaylistManager.prototype.removeFromFavourites = function(name,service,uri) {
	var self = this;

	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'Removing uri '+uri+' from favourites');

	return self.commonRemoveFromPlaylist(self.favouritesPlaylistFolder,'favourites',service,uri);
}

PlaylistManager.prototype.playFavourites = function() {
	var self = this;

	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'Playing favourites');

	return self.commonPlayPlaylist(self.favouritesPlaylistFolder,'favourites');
}

// Radio Favourites

PlaylistManager.prototype.getRadioFavouritesContent = function(name) {
	var self = this;

	return self.commonGetPlaylistContent(self.favouritesPlaylistFolder,'radio-favourites');
}

PlaylistManager.prototype.addToRadioFavourites = function(service,uri) {
	var self = this;

	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'Adding uri '+uri+' to radio-favourites');

	return self.commonAddToPlaylist(self.favouritesPlaylistFolder,'radio-favourites',service,uri);
}

PlaylistManager.prototype.removeFromRadioFavourites = function(name,service,uri) {
	var self = this;

	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'Removing uri '+uri+' from radio-favourites');

	return self.commonRemoveFromPlaylist(self.favouritesPlaylistFolder,'radio-favourites',service,uri);
}

PlaylistManager.prototype.playRadioFavourites = function() {
	var self = this;

	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'Playing radio-favourites');

	return self.commonPlayPlaylist(self.favouritesPlaylistFolder,'radio-favourites');
}

//  COMMON methods
PlaylistManager.prototype.commonAddToPlaylist = function(folder,name,service,uri) {
	var self = this;

	var defer=libQ.defer();

	var playlist=[];
	var filePath=folder+name;

	fs.exists(filePath, function (exists) {
		if(!exists)
		{
			fs.writeJsonSync(filePath,playlist);
		}

		var prms=self.commandRouter.executeOnPlugin('music_service','mpd','lsInfo',uri);
		prms.then(function(info){
			var itemInfo=info.navigation.list[0];

			var albumartPromise=self.commandRouter.executeOnPlugin('music_service','mpd','getAlbumArt',{artist:itemInfo.artist,album:itemInfo.album});
			albumartPromise.then(function(art){
				fs.readJson(filePath, function (err, data) {
					if(err)
						defer.resolve({success:false});
					else
					{
						data.push({service:service,uri:uri,title: itemInfo.title,
							artist: itemInfo.artist,
							album: itemInfo.album,albumart:art});

						fs.writeJson(filePath, data, function (err) {
							if(err)
								defer.resolve({success:false});
							else defer.resolve({success:true});
						})
					}
				});
			});





		});
	});

	return defer.promise;
}


PlaylistManager.prototype.commonRemoveFromPlaylist = function(folder,name,service,uri) {
	var self = this;

	var defer=libQ.defer();

	var playlist=[];
	var filePath=folder+name;

	fs.exists(filePath, function (exists) {
		if(!exists)
			defer.resolve({success:false,reason:'Playlist does not exist'});
		else
		{
			fs.readJson(filePath, function (err, data) {
				if(err)
					defer.resolve({success:false});
				else
				{
					var newData=[];

					for(var i=0;i<data.length;i++)
					{
						if(!(data[i].service== service &&
							data[i].uri==uri))
						{
							newData.push(data[i]);
						}

					}

					fs.writeJson(filePath, newData, function (err) {
						if(err)
							defer.resolve({success:false});
						else defer.resolve({success:true});
					})
				}
			});
		}

	});

	return defer.promise;
}

PlaylistManager.prototype.commonPlayPlaylist = function(folder,name) {
	var self = this;

	var defer=libQ.defer();

	var filePath=folder+name;

	fs.exists(filePath, function (exists) {
		if(!exists)
			defer.resolve({success:false,reason:'Playlist does not exist'});
		else
		{
			//check if file ends with .m3u extension
			if(S(name).endsWith('.m3u'))
			{
				promise=self.commandRouter.executeOnPlugin('music_service', 'mpd', 'loadPlaylist', S(name).chompRight(4).s);
				promise.then(function(result)
				{
					defer.resolve({success:true});
				}).fail(function (e) {
					defer.resolve({success:false,reason:e});
				});
			}
			else
			{
				fs.readJson(filePath, function (err, data) {
					if(err)
						defer.resolve({success:false});
					else
					{
						self.commandRouter.volumioClearQueue();

						var promises=[];
						var promise;

						self.commandRouter.executeOnPlugin('music_service', 'mpd', 'clear')
								.then(function(result){
									for(var i in data)
									{
										promise=self.commandRouter.executeOnPlugin('music_service', 'mpd', 'add', data[i].uri);
										promises.push(promise);
									}

									libQ.all(promises)
											.then(function(data){
												self.commandRouter.executeOnPlugin('music_service', 'mpd', 'resume');
												defer.resolve({success:true});
											})
											.fail(function (e) {
												defer.resolve({success:false,reason:e});
											});
								})
								.fail(function (e) {
									defer.resolve({success:false,reason:e});
								});


					}
				});
			}


		}

	});

	return defer.promise;
}

PlaylistManager.prototype.commonGetPlaylistContent = function(folder,name) {
	var self = this;

	var defer=libQ.defer();

	var filePath=folder+name;

	fs.exists(filePath, function (exists) {
		if(!exists)
			defer.reject(new Error("Playlist does not exist"));
		else
		{
			fs.readJson(filePath, function (err, data) {
				if(err)
					defer.reject(new Error("Error reading playlist"));
				else
				{
					defer.resolve(data);
				}
			});
		}

	});

	return defer.promise;
}
