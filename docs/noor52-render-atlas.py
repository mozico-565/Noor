"""Offline map renderer: true Mercator DEM, Natural Earth coastline, no invented route."""
from pathlib import Path
import json, math, numpy as np
from PIL import Image
from scipy.ndimage import map_coordinates, gaussian_filter
from matplotlib.colors import LinearSegmentedColormap, LightSource
from matplotlib.path import Path as MPath
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import sys
ROOT=Path(__file__).resolve().parents[1]; GEO=Path(sys.argv[1]); OUT=ROOT/'src/assets/journey'
def tile(lon,lat,z):return ((lon+180)/360*2**z,(1-math.asinh(math.tan(math.radians(lat)))/math.pi)/2*2**z)
def render(name,b,z,w):
 a=tile(b[0],b[3],z); c=tile(b[2],b[1],z);h=round(w*(c[1]-a[1])/(c[0]-a[0]))
 x0,y0=math.floor(a[0]),math.floor(a[1]);x1,y1=math.floor(c[0]),math.floor(c[1]); mosaic=np.zeros(((y1-y0+1)*256,(x1-x0+1)*256))
 for x in range(x0,x1+1):
  for y in range(y0,y1+1):
   arr=np.asarray(Image.open(GEO/f'{z}-{x}-{y}.png')).astype(float);dem=arr[:,:,0]*256+arr[:,:,1]+arr[:,:,2]/256-32768
   mosaic[(y-y0)*256:(y-y0+1)*256,(x-x0)*256:(x-x0+1)*256]=dem
 tx=np.linspace((a[0]-x0)*256,(c[0]-x0)*256,w);ty=np.linspace((a[1]-y0)*256,(c[1]-y0)*256,h)
 xx,yy=np.meshgrid(tx,ty);dem=map_coordinates(mosaic,[yy,xx],order=1)
 rng=np.random.default_rng(52)
 paper=np.array([232,217,184])/255
 noise=gaussian_filter(rng.normal(0,.012,(h,w)),.5)
 edge=(np.linspace(-1,1,h)[:,None]**2+np.linspace(-1,1,w)[None,:]**2)*.025
 rgb=np.clip(paper[None,None,:]+noise[:,:,None]-edge[:,:,None],0,1)
 # Real coastline mask from public-domain Natural Earth; never infer sea from height.
 coast=[];land=np.zeros((h,w),dtype=bool);pts=np.column_stack([xx.ravel()/256+x0,yy.ravel()/256+y0])
 if z==7:
  for f in json.loads((GEO/'land.geojson').read_text())['features']:
   polys=f['geometry']['coordinates'];polys=[polys] if f['geometry']['type']=='Polygon' else polys
   for poly in polys:
    ring=poly[0]
    if max(p[0] for p in ring)<b[0] or min(p[0] for p in ring)>b[2] or max(p[1] for p in ring)<b[1] or min(p[1] for p in ring)>b[3]:continue
    p=np.array([tile(lon,lat,z) for lon,lat in ring]);land|=MPath(p).contains_points(pts).reshape(h,w);coast.append(p)
  sea=np.array([.67,.72,.64]);rgb[~land]=sea
 fig=plt.figure(figsize=(w/100,h/100),dpi=100);ax=fig.add_axes([0,0,1,1]);ax.imshow(rgb,extent=[a[0],c[0],c[1],a[1]],aspect='equal')
 elev=gaussian_filter(dem,4);ax.contour(np.linspace(a[0],c[0],w),np.linspace(a[1],c[1],h),elev,levels=np.arange(100,2200 if z==7 else 1200,150 if z==7 else 100),colors='#79653c',linewidths=.65,alpha=.55)
 for p in coast:ax.plot(p[:,0],p[:,1],color='#92784a',linewidth=.85,alpha=.8)
 ax.set_xlim(a[0],c[0]);ax.set_ylim(c[1],a[1]);ax.axis('off');fig.canvas.draw()
 Image.fromarray(np.asarray(fig.canvas.buffer_rgba())[:,:,:3]).save(OUT/f'{name}-ink.webp',quality=89);plt.close(fig);print(name,w,h)
render('hijaz-atlas',[37.0,20.55,41.25,25.75],7,900)
render('makkah-atlas',[39.72,21.29,40.05,21.53],12,900)
