var wkhtmltopdf = require('wkhtmltopdf');
var MemoryStream = require('memorystream');
var streamingS3 = require('streaming-s3');
var https = require('https');

process.env['PATH'] = process.env['PATH'] + ':' + process.env['LAMBDA_TASK_ROOT'];

exports.handler = function(event, context) {
	var memStream = new MemoryStream();
	var html_utf8 = new Buffer(event.html_base64, 'base64').toString('utf8');
	var pdfOptions = event.pdfOptions || {
		'pageSize': 'letter',
		'orientation': 'Portrait'
	};

	wkhtmltopdf(html_utf8, pdfOptions, function(code, signal) {

		var baseUrl = 'https://s3.amazonaws.com/tours-pdf';
		
		var uploader = new streamingS3(memStream, {
			accessKeyId:  process.env.accessKeyId,
			secretAccessKey:  process.env.secretAccessKey
		},{
			Bucket: 'tours-pdf',
			Key: event.name + '.pdf',
			ContentType: 'application/pdf',
    		ACL: 'public-read'
		},{
			concurrentParts: 2,
			waitTime: 180000,
			retries: 1,
			maxPartSize: 10*1024*1024,    
		});

		uploader.begin(); // important if callback not provided. 
		
		uploader.on('data', function (bytesRead) {
			console.log(bytesRead, ' bytes read.');
		});
		
		uploader.on('part', function (number) {
			console.log('Part ', number, ' uploaded.');
		});
		
		// All parts uploaded, but upload not yet acknowledged. 
		uploader.on('uploaded', function (stats) {
			console.log('Upload stats: ', stats);
		});
		
		uploader.on('finished', function (resp, stats) {
			var domainPath = event.subdomain && event.subdomain !== 'prod' ? event.subdomain : 'www';
			if (event.subdomain && (event.subdomain === 'dev' || event.subdomain === 'stage')) {
				// adding in temporary u/p for dev/stage testing
				var u = encodeURIComponent(process.env.devUsername);
				var p = encodeURIComponent(process.env.devPassword);
				domainPath = u + ':' + p + '@' + domainPath;
			}

			var webhook = 'https://' + domainPath + '.tourrs.com/pdf-complete/' + event.name;
			console.log('Finished uploading PDF to S3, firing webhook: ' + webhook);

			https.get(webhook, function(response) {
				console.log('Webhook response: ' + response.statusCode);
				context.done(null, {
					url: baseUrl +  '/' + event.name + '.pdf'
				});
			}).on('error', function(e) {
				console.log('Got error: ' + e.message);
				context.done(null, 'PDF generated, but webhook failed');
			});
		});
			
		uploader.on('error', function (e) {
			console.log('Upload error: ', e);
			context.error(null, {
				error: e
			})
		});

		
	}).pipe(memStream);	
};



   