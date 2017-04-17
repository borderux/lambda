var wkhtmltopdf = require('wkhtmltopdf');
var MemoryStream = require('memorystream');
var streamingS3 = require('streaming-s3');
var https = require('https');

process.env['PATH'] = process.env['PATH'] + ':' + process.env['LAMBDA_TASK_ROOT'];

exports.handler = function(event, context) {
	var memStream = new MemoryStream();
	var html_utf8 = new Buffer(event.html_base64, 'base64').toString('utf8');
	var pdfOptions = {
		pageSize: 'letter',
		marginLeft: 0,
		marginRight: 0,
		orientation: 'Landscape',
		noFooterLine: true,
		footerHtml: '<span class="copyright">&copy; All Images are copyrighted by their respective authors &middot; &copy; Tourrs, LLC. All rights reserved.</span><div class="page-number">{{page}}</div>'
	};

	wkhtmltopdf(html_utf8, pdfOptions, function(code, signal) {

		var baseUrl = 'https://s3.amazonaws.com/tours-pdf';
		
		var filename = event.name || 'tour' + (new Date()).getTime();

		var uploader = new streamingS3(memStream, {
			accessKeyId:  process.env.accessKeyId,
			secretAccessKey:  process.env.secretAccessKey
		},{
			Bucket: 'tours-pdf',
			Key: 'tours/' + filename + '.pdf',
			ContentType: 'application/pdf'
		},{
			concurrentParts: 2,
			waitTime: 100000,
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
			var webhook = 'https://' + (event.subdomain || 'www') + '.tourrs.com/pdf-complete/' + event.pdfId;
			console.log('Finished uploading PDF to S3, firing webhook: ' + webhook);

			https.get(webhook, function(response) {
				console.log('Webhook response: ' + response.statusCode);
				context.done(null, {
					url: baseUrl +  '/' + filename + '.pdf'
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



   