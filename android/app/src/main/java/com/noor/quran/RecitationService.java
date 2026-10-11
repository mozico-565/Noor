package com.noor.quran;

import android.app.*;
import android.content.*;
import android.media.*;
import android.media.session.*;
import android.os.*;
import android.net.Uri;
import org.json.*;

/** Owns repeat timing and playback independently of the Activity/WebView. */
public class RecitationService extends Service {
    public static final String CHANNEL="noor_recitation";
    public static volatile String snapshot="{\"status\":\"idle\",\"key\":null,\"cycle\":0}";
    public interface Listener {void changed(String json);}
    public static Listener listener;
    private final Handler handler=new Handler(Looper.getMainLooper());
    private MediaPlayer player;
    private MediaSession session;
    private AudioManager audioManager;
    private AudioFocusRequest focus;
    private PowerManager.WakeLock wake;
    private JSONArray items=new JSONArray();
    private int index=0,cycle=1,count=1,generation=0;
    private long gap=0,deadline=0,remaining=0;
    private String state="idle";
    private boolean prepared=false,focusPaused=false;
    private final Runnable nextCycle=()->{remaining=0;play();};
    public static void sync(){if(listener!=null)listener.changed(snapshot);}
    @Override public void onCreate(){
        super.onCreate();
        audioManager=(AudioManager)getSystemService(AUDIO_SERVICE);
        wake=((PowerManager)getSystemService(POWER_SERVICE)).newWakeLock(PowerManager.PARTIAL_WAKE_LOCK,"Noor:Recitation");
        wake.setReferenceCounted(false);
        NotificationManager nm=(NotificationManager)getSystemService(NOTIFICATION_SERVICE);
        nm.createNotificationChannel(new NotificationChannel(CHANNEL,"تلاوة القرآن",NotificationManager.IMPORTANCE_LOW));
        session=new MediaSession(this,"NoorRecitation");
        session.setCallback(new MediaSession.Callback(){@Override public void onPlay(){resume();}@Override public void onPause(){pause();}@Override public void onStop(){finish();}});
        session.setActive(true);
        focus=new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN).setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA).setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build()).setOnAudioFocusChangeListener(change->{
            if(change==AudioManager.AUDIOFOCUS_GAIN&&focusPaused){focusPaused=false;resume();}
            else if(change<0){focusPaused="playing".equals(state)||"waiting".equals(state)||"loading".equals(state);pause();if(change==AudioManager.AUDIOFOCUS_LOSS)focusPaused=false;}
        },handler).build();
    }
    @Override public int onStartCommand(Intent intent,int flags,int startId){
        if(intent==null){finish();return START_NOT_STICKY;}
        String action=intent.getAction();
        if("pause".equals(action)){pause();return START_NOT_STICKY;}
        if("resume".equals(action)){resume();return START_NOT_STICKY;}
        if("stop".equals(action)){finish();return START_NOT_STICKY;}
        startForeground(5101,notification());
        try{
            items=new JSONArray(intent.getStringExtra("items"));if(items.length()==0)throw new IllegalArgumentException();
            count=Math.max(0,intent.getIntExtra("count",1));gap=Math.max(0,Math.min(60,intent.getIntExtra("gap",0)))*1000L;index=0;cycle=1;remaining=0;
            handler.removeCallbacks(nextCycle);releasePlayer();
            if(audioManager.requestAudioFocus(focus)!=AudioManager.AUDIOFOCUS_REQUEST_GRANTED){emit("error","تعذر الحصول على تركيز الصوت");finish();return START_NOT_STICKY;}
            acquire();play();
        }catch(Exception e){emit("error","تعذر بدء المقطع");stopForeground(STOP_FOREGROUND_REMOVE);stopSelf();}
        return START_NOT_STICKY;
    }
    private void acquire(){if(!wake.isHeld())wake.acquire();}
    private void releasePlayer(){generation++;prepared=false;if(player!=null){try{player.release();}catch(Exception ignored){}player=null;}}
    private void play(){
        releasePlayer();int token=generation;
        try{
            JSONObject item=items.getJSONObject(index);
            player=new MediaPlayer();MediaPlayer current=player;
            player.setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA).setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build());
            player.setDataSource(this,Uri.parse(item.getString("source")));
            player.setOnPreparedListener(mp->{if(token!=generation||current!=player)return;prepared=true;if(!"paused".equals(state)){mp.start();emit("playing",null);}});
            player.setOnCompletionListener(mp->{if(token!=generation||current!=player)return;index++;if(index<items.length()){play();return;}index=0;if(count>0&&cycle>=count){finish();return;}cycle++;releasePlayer();remaining=gap;deadline=SystemClock.elapsedRealtime()+remaining;emit("waiting",null);handler.postDelayed(nextCycle,remaining);});
            player.setOnErrorListener((mp,what,extra)->{if(token==generation){releasePlayer();emit("error","تعذر تشغيل الآية؛ تحقق من الملف أو الاتصال");if(wake.isHeld())wake.release();stopForeground(STOP_FOREGROUND_REMOVE);audioManager.abandonAudioFocusRequest(focus);}return true;});
            emit("loading",null);player.prepareAsync();
        }catch(Exception e){releasePlayer();emit("error","مصدر الآية غير متاح");if(wake.isHeld())wake.release();stopForeground(STOP_FOREGROUND_REMOVE);}
    }
    private void pause(){if(!"playing".equals(state)&&!"loading".equals(state)&&!"waiting".equals(state))return;if("waiting".equals(state)){remaining=Math.max(0,deadline-SystemClock.elapsedRealtime());handler.removeCallbacks(nextCycle);}try{if(player!=null&&prepared&&player.isPlaying())player.pause();}catch(Exception ignored){}emit("paused",null);if(wake.isHeld())wake.release();stopForeground(STOP_FOREGROUND_DETACH);}
    private void resume(){if(!"paused".equals(state))return;if(audioManager.requestAudioFocus(focus)!=AudioManager.AUDIOFOCUS_REQUEST_GRANTED)return;acquire();startForeground(5101,notification());if(player!=null){if(prepared){player.start();emit("playing",null);}else emit("loading",null);}else{deadline=SystemClock.elapsedRealtime()+remaining;emit("waiting",null);handler.postDelayed(nextCycle,remaining);}}
    private void finish(){handler.removeCallbacks(nextCycle);releasePlayer();if(wake!=null&&wake.isHeld())wake.release();if(audioManager!=null&&focus!=null)audioManager.abandonAudioFocusRequest(focus);emit("idle",null);stopForeground(STOP_FOREGROUND_REMOVE);stopSelf();}
    private void emit(String value,String message){state=value;try{JSONObject json=new JSONObject();json.put("status",value);json.put("key",value.equals("idle")?JSONObject.NULL:items.optJSONObject(index).optString("key"));json.put("cycle",value.equals("idle")?0:cycle);if(message!=null)json.put("message",message);snapshot=json.toString();}catch(Exception ignored){}sync();if(session!=null){int p=value.equals("playing")?PlaybackState.STATE_PLAYING:value.equals("paused")?PlaybackState.STATE_PAUSED:value.equals("idle")?PlaybackState.STATE_STOPPED:PlaybackState.STATE_BUFFERING;session.setPlaybackState(new PlaybackState.Builder().setActions(PlaybackState.ACTION_PLAY|PlaybackState.ACTION_PAUSE|PlaybackState.ACTION_STOP).setState(p,0,1).build());session.setMetadata(new MediaMetadata.Builder().putString(MediaMetadata.METADATA_KEY_TITLE,"تلاوة القرآن · "+(items.optJSONObject(index)==null?"":items.optJSONObject(index).optString("key"))).putString(MediaMetadata.METADATA_KEY_ARTIST,"نور").build());}if(!value.equals("idle")&&!value.equals("error"))((NotificationManager)getSystemService(NOTIFICATION_SERVICE)).notify(5101,notification());}
    private PendingIntent action(String value,int request){return PendingIntent.getService(this,request,new Intent(this,RecitationService.class).setAction(value),PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);}
    private Notification notification(){boolean paused=state.equals("paused");return new Notification.Builder(this,CHANNEL).setSmallIcon(android.R.drawable.ic_media_play).setContentTitle("تلاوة القرآن · نور").setContentText("التكرار "+cycle).setContentIntent(PendingIntent.getActivity(this,51,new Intent(this,MainActivity.class),PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE)).setOnlyAlertOnce(true).setOngoing(!paused).setStyle(new Notification.MediaStyle().setMediaSession(session.getSessionToken()).setShowActionsInCompactView(0,1)).addAction(new Notification.Action.Builder(paused?android.R.drawable.ic_media_play:android.R.drawable.ic_media_pause,paused?"تشغيل":"إيقاف مؤقت",action(paused?"resume":"pause",52)).build()).addAction(new Notification.Action.Builder(android.R.drawable.ic_menu_close_clear_cancel,"إلغاء",action("stop",53)).build()).build();}
    @Override public void onDestroy(){handler.removeCallbacksAndMessages(null);releasePlayer();if(wake!=null&&wake.isHeld())wake.release();if(audioManager!=null&&focus!=null)audioManager.abandonAudioFocusRequest(focus);if(session!=null)session.release();snapshot="{\"status\":\"idle\",\"key\":null,\"cycle\":0}";sync();super.onDestroy();}
    @Override public IBinder onBind(Intent intent){return null;}
}
