# lambda
All of the AWS lambda functions

To create a Lambda function, install the lamda-local global npm package. This will enable you to test lambda functions before uploading them.
`npm install -g lambda-local`

then to test your functions run: 
`lambda-local -l index.js -t 300 -h handler -e ../event-samples/<name of your sample file>.js`

You'll also need to upload all of your node packages as part of a zip file to make this work. `npm i` anything in the `require` statement of your js file.

To zip your package for uploading to AWS, run the following command from within the `lambda` folder for the function (do not include the containing folder in the zip):

`zip -r ../<name of your lambda function>.zip *`

It is recommended to then upload the `zip` file to `S3` and reference it from within the lambda function drop down on AWS. Also, don't forget to add your sample data to the lambda sample function as well. It will be a simple JSON object.
