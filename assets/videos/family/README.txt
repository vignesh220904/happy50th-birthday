Family-supplied videos for the presentation
===========================================

1. Her Life Journey film (not supplied yet)
   Save the family's Life Journey video here as   life-journey.mp4
   and set data/site.json -> videos.lifeJourney.src to
       "assets/videos/family/life-journey.mp4"
   The "Her Life Journey Film" scene joins the presentation (after Happy 50th
   Birthday) once the file exists. Until then it is left out entirely.

2. Messages Filled With Love (the "Family video wishes" Google Drive folder)
   These are not saved here. Download the Drive folder into the project root as
       Family video wishes/
   keeping the family's numbered filenames, then run
       npm run build:wishes
   It converts every video to a browser-ready copy in assets/videos/wishes/,
   keeps the family's order, and writes data/wishes.json. The final two videos
   wait for the family's confirmation ("confirmed": false in data/wishes.json).

Format: MP4 with H.264 video and AAC audio plays everywhere. Phone videos are
often HEVC (H.265), which some browsers cannot play. build:wishes converts them
automatically; to convert the Life Journey video by hand:

  python -c "import imageio_ffmpeg,subprocess,sys; subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(),'-i',sys.argv[1],'-c:v','libx264','-crf','20','-pix_fmt','yuv420p','-c:a','aac','-b:a','160k','-movflags','+faststart',sys.argv[2]],check=True)" input.mov life-journey.mp4

(needs: pip install imageio-ffmpeg)
