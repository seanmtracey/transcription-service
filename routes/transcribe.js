const debug = require('debug')('transcription:routes:index');
const express = require('express');
const router = express.Router();
const shortID = require('shortid').generate;

const requireToken = require('../bin/lib/require-token');
const limitRequestSize = require('../bin/lib/limit-request-size');

const receiveFile = require('../bin/lib/receive-file');
const absorbFile = require('../bin/lib/absorb-file');
const extractAudio = require('../bin/lib/extract-audio');
const splitAudio = require('../bin/lib/split-audio');
const transcribeAudio = require('../bin/lib/transcribe-audio');
const cleanUp = require('../bin/lib/clean-up');
const getTimeIndexes = require('../bin/lib/generate-time-indexes');
const generateVTT = require('../bin/lib/generate-vtt-file');

function prepareAudio(filePath, jobID, duration){

	return extractAudio(filePath, jobID)
		.then(file => splitAudio(file, jobID, duration))
	;

}

function generateTranscriptions(audioFile, req, res){

	console.time('entire-process');
	const jobID = shortID();

	// Convert the audio to .wav format
	prepareAudio(audioFile, jobID, 55) 
		// Get a transcription of the whole audio to serve as a guide for the chunks
		.then(audio => transcribeAudio(audio))
		.then(transcriptions => {
			debug('Whole transcriptions:', transcriptions);
			transcriptions = transcriptions.join(' ');

			// Split the audio file into 3 second chunks for time-based transcriptions
			return prepareAudio(audioFile, jobID)
				.then(files => {
					// Get the time indexes + offsets for each audio chunk
					return getTimeIndexes(files)
						.then(durations => {
							return {
								files,
								durations
							};
						})
					;

				})
				.then(data => {
					// Transcribe all of the smaller audio chunks
					return transcribeAudio(data.files, transcriptions)
						.then(transcriptions => {
							// Link up the small audio transcriptions with the 
							// time indexes of each file
							return transcriptions.map( (t, idx) => {
								return {
									transcription : t,
									timeOffsets : data.durations[idx]
								};
							});
						})
						.then(transcribedChunks => { 
							return {
								whole : transcriptions,
								transcribedChunks
							};
						})
					;
				})
			;

		})
		.then(transcriptions => {
			debug(transcriptions);
			console.time('entire-process');
			if(req.query.output === undefined){
				res.json(transcriptions.transcribedChunks);
			} else if(req.query.output === "vtt"){
				// If a VTT has been requested, output a VTT file
				generateVTT(transcriptions.transcribedChunks)
					.then(VTT => {
						res.type('text/vtt');
						res.send(VTT);
					})
					.catch(err => {
						debug(err);
						res.status(err.status || 500);
						res.json({
							status : 'error',
							message : 'An error occurred as we tried to generate a VTT file. Results return as JSON',
							data : transcriptions.transcribedChunks
						});
					})
				;
			} else {
				// Otherwise, just send the transcribed chunks.
				res.json(transcriptions.transcribedChunks);				
			}
			
			cleanUp(jobID);
		})
		.catch(err => {
			console.time('entire-process');
			debug(err);
			cleanUp(jobID);
			res.status(500);
			res.json({
				status : 'error',
				message : 'An error occurred as we tried to generate the transcription for this media.'
			});
		})
	;
	
}

router.use(requireToken);

router.get('/',function(req, res){

	if(req.query.resource){
		absorbFile(req.query.resource).then(file => generateTranscriptions(file, req, res));
	} else {
		res.status(422);
		res.json({
			status : `error`,
			message : `You must pass a URL with the 'resource' query parameter pointing to the media file you wish to have transcribed.`
		});
	}

});

router.use(limitRequestSize);
router.post('/', function(req, res) {
	debug(req.body);
	receiveFile(req).then(file => generateTranscriptions(file, req, res));
});

module.exports = router;
