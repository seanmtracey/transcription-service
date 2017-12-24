const express = require('express');
const router = express.Router();
const auth = require('../bin/lib/auth');

const validFiles = require('../bin/lib/valid-file');
const validLanguages = require('../bin/lib/valid-language-codes');

router.get('/', auth, function(req, res, next){

	res.render('index', {
		title : 'SMT Transcription Service',
		serviceName : process.env.SERVICE_NAME || 'SMT Transcription Service',
		shortServiceName : process.env.SERVICE_NAME || 'SMT Transcriptions',
		validFileTypes : validFiles.getTypes,
		languageOptions : validLanguages.list
	});

});	

module.exports = router;