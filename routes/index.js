const express = require('express');
const router = express.Router();
const auth = require('../bin/lib/auth');

const validFiles = require('../bin/lib/valid-file');
const validLanguages = require('../bin/lib/valid-language-codes');

router.get('/', auth, function(req, res, next){

	res.render('index', {
		title : 'FT Labs Transcription Service',
		serviceName : process.env.SERVICE_NAME || 'FT Labs Transcription Service',
		shortServiceName : process.env.SERVICE_NAME || 'FT Labs Transcriptions',
		validFileTypes : validFiles.getTypes,
		languageOptions : validLanguages.list
	});

});	

module.exports = router;