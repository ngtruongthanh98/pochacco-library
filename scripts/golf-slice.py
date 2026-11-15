import numpy as np, sys
from PIL import Image, ImageFilter
from scipy import ndimage as nd
U='/mnt/user-data/uploads/%s-image.png'
SHEETS={
 'f2b14cce':['idle','ready','address_ball','backswing','swing','follow_through','aiming','putt','cheer','love_club','victory_trophy','worried','dizzy','jump','sit','dream_hole'],
 'c76e3676':['blue_otter_costume','white_sheep','pink_bunny','dark_sheep','brown_haired_boy','soccer_ball','plain_ball','star_ball','heart_ball','rainbow_ball','paw_ball','snowflake_ball','fire_ball','cloud_ball','lightning_ball','golden_ball'],
 '5d08931f':['wood_club','iron_club','putter_club','blue_club','mint_golf_bag','blue_golf_bag','golf_cart','beige_tee','coral_tee','blue_tee','hole_with_flag','aim_target','power_meter','play_button','pause_button','settings_button'],
 '42197945':['ribbon_idle','ribbon_address','ribbon_putt','ribbon_backswing','ribbon_follow','ribbon_hit','ribbon_cheer','ribbon_trophy','ribbon_hug_ball','ribbon_sit','ribbon_dream','ribbon_surprise','ribbon_wink','ribbon_jump','ribbon_rest','ribbon_cart'],
 '4911ff12':['green_square','flower_grass','sand_bunker','water_tile','snow_tile','autumn_tile','stone_tile','hole_grass_flag','wood_bridge','rock_cluster','flower_bush','cherry_tree','palm_tree','bamboo','rest_bench','wood_sign'],
}
# chỉ giữ thân chính (bỏ vạch, lấp lánh) cho bóng và bạn caddie
MAIN_ONLY={'fire_ball','cloud_ball','blue_otter_costume','white_sheep','pink_bunny','dark_sheep','brown_haired_boy','soccer_ball','plain_ball','star_ball','heart_ball','rainbow_ball','paw_ball','snowflake_ball','lightning_ball','golden_ball','hole_with_flag','hole_grass_flag'}
HULL={'plain_ball','star_ball','heart_ball','rainbow_ball','paw_ball','snowflake_ball','fire_ball','cloud_ball','lightning_ball','golden_ball','green_square','flower_grass','sand_bunker','water_tile','snow_tile','autumn_tile','stone_tile','play_button','pause_button','settings_button','beige_tee','coral_tee','blue_tee'}
from skimage.morphology import convex_hull_image
TILES={'green_square','flower_grass','sand_bunker','water_tile','snow_tile','autumn_tile','stone_tile'}
out=sys.argv[1]
for sid,names in SHEETS.items():
    a=np.asarray(Image.open(U%sid).convert('RGB')).astype(int)
    H,W,_=a.shape; s=W/4
    for i,n in enumerate(names):
        r,c=divmod(i,4); m=14
        y0,y1,x0,x1=int(r*s)+m,int((r+1)*s)-m,int(c*s)+m,int((c+1)*s)-m
        b=a[y0:y1,x0:x1]
        e=np.concatenate([b[:3].reshape(-1,3),b[-3:].reshape(-1,3),b[:,:3].reshape(-1,3),b[:,-3:].reshape(-1,3)])
        bg=np.median(e,0)
        d=np.abs(b-bg).sum(2); sat=b.max(2)-b.min(2)
        ring=nd.binary_dilation(b.min(2)>=250,iterations=1)
        cand=(d<40)&(sat<22)&~ring
        lab,_=nd.label(cand)
        edge=set(np.unique(np.concatenate([lab[0],lab[-1],lab[:,0],lab[:,-1]])))-{0}
        bgm=np.isin(lab,list(edge))
        fg=~bgm
        fg=nd.binary_opening(fg,iterations=1)
        if n in MAIN_ONLY: fg=nd.binary_opening(fg,iterations=2)
        lab2,k=nd.label(fg)
        sizes=nd.sum(fg,lab2,range(1,k+1))
        keep=[j+1 for j,sz in enumerate(sizes) if sz>=60]
        if n in MAIN_ONLY: keep=[int(np.argmax(sizes))+1]
        fg=np.isin(lab2,keep); fg=nd.binary_fill_holes(fg)
        if n.endswith('_ball') and n not in ('soccer_ball','address_ball'):
            core=nd.binary_opening(fg,iterations=6)
            l3,k3=nd.label(core); sz=nd.sum(core,l3,range(1,k3+1)); core=l3==(int(np.argmax(sz))+1)
            ys,xs=np.where(core); cy,cx=ys.mean(),xs.mean(); R=np.sqrt(core.sum()/np.pi)+2
            Y,X=np.ogrid[:fg.shape[0],:fg.shape[1]]; fg=(Y-cy)**2+(X-cx)**2<=R*R
        elif n in HULL:
            fg=nd.binary_fill_holes(nd.binary_closing(np.pad(fg,12),structure=np.ones((3,3)),iterations=7))[12:-12,12:-12]
        ys,xs=np.where(fg); p=3
        yy0,yy1,xx0,xx1=max(ys.min()-p,0),min(ys.max()+p+1,fg.shape[0]),max(xs.min()-p,0),min(xs.max()+p+1,fg.shape[1])
        alpha=Image.fromarray((fg*255).astype('uint8')).filter(ImageFilter.GaussianBlur(0.8))
        rgba=Image.fromarray(b.astype('uint8')).convert('RGBA'); rgba.putalpha(alpha)
        rgba=rgba.crop((xx0,yy0,xx1,yy1))
        if n in TILES:
            w_,h_=rgba.size; k=0.15
            rgba=rgba.crop((int(w_*k),int(h_*k),int(w_*(1-k)),int(h_*(1-k)))).convert('RGB').resize((160,160),Image.LANCZOS)
        rgba.save(f'{out}/{n}.webp',quality=90,method=6)
        print(n,rgba.size)
