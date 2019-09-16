var _ = require('lodash');
var logger = require('./lib/utils/logger');
var chalk = require('chalk');
var http = require('http');
var Primus = require('primus');
var express = require('express');
var app = express();
var path = require('path');
var bodyParser = require('body-parser');

var banned = require('./lib/utils/config').banned;
var apiRouter = require('./lib/routers/api');

var server = http.createServer(app);

// view engine setup
app.set('views', path.join(__dirname, (process.env.LITE === 'true' ? './src-lite/views' : './src/views')));
app.set('view engine', 'jade');
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, (process.env.LITE === 'true' ? './dist-lite' : './dist'))));

// Init WS SECRET
var WS_SECRET;

if( !_.isUndefined(process.env.WS_SECRET) && !_.isNull(process.env.WS_SECRET) )
{
	if( process.env.WS_SECRET.indexOf('|') > 0 )
	{
		WS_SECRET = process.env.WS_SECRET.split('|');
	}
	else
	{
		WS_SECRET = [process.env.WS_SECRET];
	}
}
else
{
	try {
		var tmp_secret_json = require('./ws_secret.json');
		WS_SECRET = _.values(tmp_secret_json);
	}
	catch (e)
	{
		console.error("WS_SECRET NOT SET!!!");
	}
}

// Init API Socket connection
var api = new Primus(server, {
	transformer: 'websockets',
	pathname: '/api',
	parser: 'JSON'
});

api.plugin('emit', require('primus-emit'));
api.plugin('spark-latency', require('primus-spark-latency'));

// Init Client Socket connection
var client = new Primus(server, {
	transformer: 'websockets',
	pathname: '/primus',
	parser: 'JSON'
});

client.plugin('emit', require('primus-emit'));

// Init external API
var external = new Primus(server, {
	transformer: 'websockets',
	pathname: '/external',
	parser: 'JSON'
});

external.plugin('emit', require('primus-emit'));

// Init collections
var Collection = require('./lib/collection');
var Nodes = new Collection(external);

Nodes.setChartsCallback(function (err, charts)
{
	if(err !== null)
	{
		console.error('COL', 'CHR', 'Charts error:', err);
	}
	else
	{
		client.write({
			action: 'charts',
			data: charts
		});
	}
});

app.get('/', function(req, res) {
	res.render('index');
});

app.get('/ping', function(req, res) {
    res.json({
		result: true,
        message: 'pong',
    });
});

//노드 자원 관련 API
app.use('/v1/api/res', apiRouter);

//블록체인 노드 관련 API
app.get('/v1/api/node', function(req, res){
	res.json(Nodes.all())
});

app.get('/v1/api/node/:id', function(req, res){
	var id = req.params.id;
	var node = Nodes.getNode({id: id});
	if(node)
		res.json({
			result: true,
			data: node
		});
	else
		res.json({
			result: false,
			message: '유효하지 않은 노드ID 입니다.',
		});
});

app.get('/v1/api/node/stats/:id', function(req, res){
	var id = req.params.id;
	var node = Nodes.getNode({id: id})

	if(node)
		res.json({
			result: true,
			data: node.getStats(),
		});
	else
		res.json({
			result: false,
			message: '유효하지 않은 노드ID 입니다.',
		});
})

app.get('/v1/api/node/info/:id', function(req, res){
	var id = req.params.id;
	var node = Nodes.getNode({id: id})
	if(node)
		res.json({
			result: true,
			data: node.getInfo(),
		});
	else
		res.json({
			result: false,
			message: '유효하지 않은 노드ID 입니다.',
		});
})

app.get('/v1/api/node/propagation', function(req, res){
	res.json(Nodes.blockPropagationChart())
})

// catch 404 and forward to error handler
app.use(function(req, res, next) {
	var err = new Error('Not Found');
	err.status = 404;
	next(err);
});

// error handlers
app.use(function(err, req, res, next) {
	res.status(err.status || 500);
	res.render('error', {
		message: err.message,
		error: err
	});
});

// production error handler
app.use(function(err, req, res, next) {
	res.status(err.status || 500);
	res.render('error', {
		message: err.message,
		error: {}
	});
});

// Init API Socket events
api.on('connection', function (spark)
{
	console.info('API', 'CON', 'Open:', spark.address.ip);

	spark.on('hello', function (data)
	{
		console.info('API', 'CON', 'Hello', data['id']);

		if( _.isUndefined(data.secret) || WS_SECRET.indexOf(data.secret) === -1 || banned.indexOf(spark.address.ip) >= 0 )
		{
			spark.end(undefined, { reconnect: false });
			console.error('API', 'CON', 'Closed - wrong auth', data);

			return false;
		}

		if( !_.isUndefined(data.id) && !_.isUndefined(data.info) )
		{
			data.ip = spark.address.ip;
			data.spark = spark.id;
			data.latency = spark.latency || 0;

			Nodes.add( data, function (err, info)
			{
				if(err !== null)
				{
					console.error('API', 'CON', 'Connection error:', err);
					return false;
				}

				if(info !== null)
				{
					spark.emit('ready');

					console.success('API', 'CON', 'Connected', data.id);

					client.write({
						action: 'add',
						data: info
					});
				}
			});
		}
	});


	spark.on('update', function (data)
	{
		if( !_.isUndefined(data.id) && !_.isUndefined(data.stats) )
		{
			Nodes.update(data.id, data.stats, function (err, stats)
			{
				if(err !== null)
				{
					console.error('API', 'UPD', 'Update error:', err);
				}
				else
				{
					if(stats !== null)
					{
						client.write({
							action: 'update',
							data: stats
						});

						console.info('API', 'UPD', 'Update from:', data.id, 'for:', stats);

						Nodes.getCharts();
					}
				}
			});
		}
		else
		{
			console.error('API', 'UPD', 'Update error:', data);
		}
	});


	spark.on('block', function (data)
	{
		if( !_.isUndefined(data.id) && !_.isUndefined(data.block) )
		{
			Nodes.addBlock(data.id, data.block, function (err, stats)
			{
				if(err !== null)
				{
					console.error('API', 'BLK', 'Block error:', err);
				}
				else
				{
					if(stats !== null)
					{
						client.write({
							action: 'block',
							data: stats
						});

						console.success('API', 'BLK', 'Block:', data.block['number'], 'from:', data.id);

						Nodes.getCharts();
					}
				}
			});
		}
		else
		{
			console.error('API', 'BLK', 'Block error:', data);
		}
	});


	spark.on('pending', function (data)
	{
		if( !_.isUndefined(data.id) && !_.isUndefined(data.stats) )
		{
			Nodes.updatePending(data.id, data.stats, function (err, stats) {
				if(err !== null)
				{
					console.error('API', 'TXS', 'Pending error:', err);
				}

				if(stats !== null)
				{
					client.write({
						action: 'pending',
						data: stats
					});

					console.success('API', 'TXS', 'Pending:', data.stats['pending'], 'from:', data.id);
				}
			});
		}
		else
		{
			console.error('API', 'TXS', 'Pending error:', data);
		}
	});


	spark.on('stats', function (data)
	{
		if( !_.isUndefined(data.id) && !_.isUndefined(data.stats) )
		{

			Nodes.updateStats(data.id, data.stats, function (err, stats)
			{
				if(err !== null)
				{
					console.error('API', 'STA', 'Stats error:', err);
				}
				else
				{
					if(stats !== null)
					{
						client.write({
							action: 'stats',
							data: stats
						});

						console.success('API', 'STA', 'Stats from:', data.id);
					}
				}
			});
		}
		else
		{
			console.error('API', 'STA', 'Stats error:', data);
		}
	});


	spark.on('history', function (data)
	{
		console.success('API', 'HIS', 'Got history from:', data.id);

		var time = chalk.reset.cyan((new Date()).toJSON()) + " ";
		console.time(time, 'COL', 'CHR', 'Got charts in');

		Nodes.addHistory(data.id, data.history, function (err, history)
		{
			console.timeEnd(time, 'COL', 'CHR', 'Got charts in');

			if(err !== null)
			{
				console.error('COL', 'CHR', 'History error:', err);
			}
			else
			{
				client.write({
					action: 'charts',
					data: history
				});
			}
		});
	});


	spark.on('node-ping', function (data)
	{
		var start = (!_.isUndefined(data) && !_.isUndefined(data.clientTime) ? data.clientTime : null);

		spark.emit('node-pong', {
			clientTime: start,
			serverTime: _.now()
		});

		console.info('API', 'PIN', 'Ping from:', data['id']);
	});


	spark.on('latency', function (data)
	{
		if( !_.isUndefined(data.id) )
		{
			Nodes.updateLatency(data.id, data.latency, function (err, latency)
			{
				if(err !== null)
				{
					console.error('API', 'PIN', 'Latency error:', err);
				}

				if(latency !== null)
				{
					// client.write({
					// 	action: 'latency',
					// 	data: latency
					// });

					console.info('API', 'PIN', 'Latency:', latency, 'from:', data.id);
				}
			});

			if( Nodes.requiresUpdate(data.id) )
			{
				var range = Nodes.getHistory().getHistoryRequestRange();

				spark.emit('history', range);
				console.info('API', 'HIS', 'Asked:', data.id, 'for history:', range.min, '-', range.max);

				Nodes.askedForHistory(true);
			}
		}
	});


	spark.on('end', function (data)
	{
		Nodes.inactive(spark.id, function (err, stats)
		{
			if(err !== null)
			{
				console.error('API', 'CON', 'Connection end error:', err);
			}
			else
			{
				client.write({
					action: 'inactive',
					data: stats
				});

				console.warn('API', 'CON', 'Connection with:', spark.id, 'ended:', data);
			}
		});
	});
});


client.on('connection', function (clientSpark)
{
	clientSpark.on('ready', function (data)
	{
		clientSpark.emit('init', { nodes: Nodes.all() });

		Nodes.getCharts();
	});

	clientSpark.on('client-pong', function (data)
	{
		var serverTime = _.get(data, "serverTime", 0);
		var latency = Math.ceil( (_.now() - serverTime) / 2 );

		clientSpark.emit('client-latency', { latency: latency });
	});
});

var latencyTimeout = setInterval( function ()
{
	client.write({
		action: 'client-ping',
		data: {
			serverTime: _.now()
		}
	});
}, 5000);


// Cleanup old inactive nodes
var nodeCleanupTimeout = setInterval( function ()
{
	client.write({
		action: 'init',
		data: Nodes.all()
	});

	Nodes.getCharts();

}, 1000*60*60);

server.listen(process.env.PORT || 30311);

module.exports = server;
