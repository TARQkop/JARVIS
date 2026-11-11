module.exports = (req, res) => res.status(200).json({
  ok: true,
  keyConfigured: !!process.env.GROQ_API_KEY,
  voiceConfigured: !!process.env.ELEVENLABS_API_KEY,
});
