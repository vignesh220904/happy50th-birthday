Family-supplied videos for the presentation
===========================================

Save the family's videos in this folder with exactly these names:

  life-journey.mp4     The Life Journey film       (scene 3, "Her Life Journey")
  family-wishes.mp4    The family members' wishes  (scene 8, "Family Wishes")

They appear automatically the next time the site is opened. Until then each
scene shows a graceful placeholder. The paths are set in data/site.json
(videos.lifeJourney.src) and data/wishes.json (videos[0].src).

Format: MP4 with H.264 video and AAC audio plays everywhere. Phone videos are
often HEVC (H.265), which some browsers cannot play; convert them first:

  python -c "import imageio_ffmpeg,subprocess,sys; subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(),'-i',sys.argv[1],'-c:v','libx264','-crf','20','-pix_fmt','yuv420p','-c:a','aac','-b:a','160k','-movflags','+faststart',sys.argv[2]],check=True)" input.mov life-journey.mp4

(needs: pip install imageio-ffmpeg)
