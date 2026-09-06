import bpy, math, random, os, json, sys
from mathutils import Vector
from mathutils.geometry import tessellate_polygon
from math import sin,cos,pi,sqrt

random.seed(861)
ROOT='/workspace/sites/cabbageland'
OUT=ROOT+'/dist/models'
os.makedirs(OUT,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
for block in bpy.data.materials: bpy.data.materials.remove(block)
S=bpy.context.scene
S.render.engine='CYCLES';S.cycles.samples=32;S.cycles.use_denoising=True
S.render.threads_mode='FIXED';S.render.threads=8
S.render.resolution_x=1440;S.render.resolution_y=1000;S.render.resolution_percentage=75
S.world.use_nodes=True;S.world.node_tree.nodes['Background'].inputs[0].default_value=(.56,.78,.92,1);S.world.node_tree.nodes['Background'].inputs[1].default_value=.55
S.view_settings.view_transform='AgX';S.view_settings.look='AgX - Medium High Contrast';S.view_settings.exposure=.35
M={}
def rgb(h):
 h=h.lstrip('#');return tuple(int(h[i:i+2],16)/255 for i in (0,2,4))
def linear(c):return c/12.92 if c<.04045 else ((c+.055)/1.055)**2.4
def mat(name,col,rough=.8,metal=0,emission=0,alpha=1,vertex=False):
 m=bpy.data.materials.new(name);m.diffuse_color=(*rgb(col),alpha);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');color=tuple(linear(c) for c in rgb(col));p.inputs['Base Color'].default_value=(*color,alpha);p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal
 if alpha<1:p.inputs['Alpha'].default_value=alpha;m.surface_render_method='DITHERED'
 if emission:p.inputs['Emission Color'].default_value=(*color,1);p.inputs['Emission Strength'].default_value=emission
 if vertex:
  n=m.node_tree.nodes.new('ShaderNodeVertexColor');n.layer_name='Col';m.node_tree.links.new(n.outputs['Color'],p.inputs['Base Color'])
 M[name]=m;return m
grass=mat('Grass','#70a629',vertex=True);soil=mat('Rich soil','#755032');rock=mat('Weathered limestone','#748078',vertex=True)
wood=mat('Oiled walnut','#8e562b');cedar=mat('Honey cedar','#bd884a');trim=mat('Ochre trim','#d7b26a');cream=mat('Warm plaster','#efecd3');dark=mat('Deep forest','#193c32')
steel=mat('Patinated greenhouse steel','#457c72',.43,.25);paleSteel=mat('Pale steel','#96bc9b',.38,.25);glass=mat('Glass','#9ce4dc',.15,.05,alpha=.18)
slate=mat('Blue slate','#395d62');stone=mat('Path stone','#b3b9a5');gold=mat('Gramophone brass','#d9a233',.27,.62);orange=mat('Persimmon','#d8743b');paper=mat('Paper','#eee9d3');navy=mat('Denim','#296680')
leafMat=mat('Living cabbage leaf','#84b932',vertex=True);vein=mat('Leaf veins','#c2d86d');edge=mat('Leaf margins','#a7cd54');bark=mat('Bark','#67573c');foliage=mat('Canopy foliage','#438c2a',vertex=True)
water=mat('River water','#29aacc',.2,.08,emission=.08);foam=mat('Water foam','#dcf8f0',.3,emission=.1);fallMat=mat('Waterfall','#48c4ea',.18,.1,emission=.1);glow=mat('Lamplight','#ffda84',.35,emission=3)
flowerM=[mat('Flower '+str(i),c) for i,c in enumerate(['#e6c551','#f5edbd','#e0a396'])]

def obj_mesh(name,verts,faces,material,cols=None):
 me=bpy.data.meshes.new(name);me.from_pydata(verts,[],faces);me.update();o=bpy.data.objects.new(name,me);S.collection.objects.link(o);me.materials.append(material)
 for p in me.polygons:p.use_smooth=True
 if cols:
  attr=me.color_attributes.new(name='Col',type='FLOAT_COLOR',domain='POINT')
  for i,c in enumerate(cols):attr.data[i].color=tuple(linear(v) for v in c[:3])+(1,)
 return o
def cube(name,loc,scale,m,bevel=.035):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.name=name;o.scale=scale;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(m)
 if bevel:
  mod=o.modifiers.new('Soft crafted edges','BEVEL');mod.width=bevel;mod.segments=2
  mod=o.modifiers.new('Weighted corner normals','WEIGHTED_NORMAL')
 return o
def uvball(name,loc,scale,m,detail=16,deform=0,color=None):
 vs=[];fs=[];cs=[]
 for j in range(detail//2+1):
  p=pi*j/(detail//2)
  for i in range(detail):
   t=2*pi*i/detail;v=Vector((sin(p)*cos(t),sin(p)*sin(t),cos(p)));n=1+deform*(sin(v.x*9+v.y*5)*sin(v.z*8+v.x*3)+.5*cos(v.y*13-v.z*4));vs.append(tuple(loc[k]+v[k]*scale[k]*n for k in range(3)))
   if color:
    b=.89+.10*sin(v.x*7+v.y*11+v.z*5)+.08*v.z;cs.append(tuple(min(1,max(0,c*b)) for c in rgb(color)))
   if j<detail//2:fs.append((j*detail+i,j*detail+(i+1)%detail,(j+1)*detail+(i+1)%detail,(j+1)*detail+i))
 return obj_mesh(name,vs,fs,m,cs or None)
def cylinder(name,loc,r,depth,m,vertices=16,r2=None):
 bpy.ops.mesh.primitive_cone_add(vertices=vertices,radius1=r,radius2=r if r2 is None else r2,depth=depth,location=loc);o=bpy.context.object;o.name=name;o.data.materials.append(m)
 for p in o.data.polygons:p.use_smooth=True
 return o
def tube(name,points,r,m,cyclic=False):
 c=bpy.data.curves.new(name,'CURVE');c.dimensions='3D';c.resolution_u=1;c.bevel_depth=r;c.bevel_resolution=1;c.resolution_u=8
 sp=c.splines.new('POLY');sp.points.add(len(points)-1)
 for p,co in zip(sp.points,points):p.co=(*co,1)
 sp.use_cyclic_u=cyclic;o=bpy.data.objects.new(name,c);S.collection.objects.link(o);c.materials.append(m);return o
def bar(name,a,b,r,m):return tube(name,[a,b],r,m)
def torus(name,loc,major,minor,m,rot=(0,0,0)):
 bpy.ops.mesh.primitive_torus_add(major_radius=major,minor_radius=minor,major_segments=40,minor_segments=6,location=loc,rotation=rot);o=bpy.context.object;o.name=name;o.data.materials.append(m);return o
def patch(name,points,z,depth,m,color=None):
 n=len(points);vs=[(x,y,z) for x,y in points]+[(x,y,z-depth) for x,y in points];faces=[tuple(range(n)),tuple(range(2*n-1,n-1,-1))]
 for i in range(n):faces.append((i,(i+1)%n,(i+1)%n+n,i+n))
 cols=[tuple(c*(.9+.07*sin(x*.8+y*1.3)) for c in rgb(color)) for x,y,h in vs] if color else None
 return obj_mesh(name,vs,faces,m,cols)
def ellipse_points(x,y,rx,ry,n=56,noise=.03):return [(x+cos(i*2*pi/n)*rx*(1+noise*sin(i*1.7)),y+sin(i*2*pi/n)*ry*(1+noise*cos(i*1.3))) for i in range(n)]

# Cabbages are genuinely wrapped leaves; leaf shape, veins and curled rims are meshes.
plant_data=[]
def cabbage(name,center,size,quality=1,interactive=False):
 before=set(bpy.data.objects);cx,cy,cz=center
 specs=[(8,1.32,2.85,1.5,.72),(7,1.03,2.7,.64,.83),(6,.87,2.5,.10,.92)] if quality else [(6,1.25,2.8,1.5,.8),(6,.97,2.65,.20,1.05)]
 for ring,(count,R,p0,p1,width) in enumerate(specs):
  for k in range(count):
   angle=k/count*2*pi+ring*.59;U=18 if quality else 10;V=24 if quality else 13
   def point(u,v,raise_=0):
    phi=p0+(p1-p0)*v;w=width*(sin(pi*v)**.45);th=angle+u*w
    rr=R*(1+.027*sin(v*26+u*9+ring)*abs(u)**2+.014*cos(u*18-v*15))
    if ring==0:rr+=.2*v**5
    zz=.88+cos(phi)*rr+.05*sin(v*18+u*8)*abs(u)**2+.035*abs(u)**4
    return (cx+size*(sin(phi)*rr+raise_)*cos(th),cy+size*(sin(phi)*rr+raise_)*sin(th),cz+size*zz)
   vs=[];fs=[];cols=[]
   base=rgb(['#498d1b','#75ad2a','#9fc83b'][min(ring,2)])
   for j in range(V+1):
    v=j/V
    for i in range(U+1):
     u=i/U*2-1;vs.append(point(u,v));light=.85+.20*v+.035*sin(v*25+u*16);border=max(0,(abs(u)-.85)/.15)*.19+max(0,(v-.94)/.06)*.16
     cols.append(tuple(min(1,c*light+border*f) for c,f in zip(base,[.7,.55,.18])))
     if j<V and i<U:
      n=j*(U+1)+i;fs.append((n,n+1,n+U+2,n+U+1))
   obj_mesh(name+' leaf',vs,fs,leafMat,cols)
   if quality:
    tube(name+' midrib',[point(0,.03+.94*t/24,.012) for t in range(25)],size*.009,vein)
    for q in [.22,.38,.54,.69,.82]:
     for sign in [-1,1]:
      tube(name+' secondary vein',[point(sign*.85*t/9,min(.96,q+.13*t/9),.009) for t in range(10)],size*.0038,vein)
    # A fine raised lip makes the overlapping silhouette readable.
    tube(name+' rolled edge',[point(-1,.02+.96*t/22,.005) for t in range(23)]+[point(1,.98-.96*t/22,.005) for t in range(23)],size*.007,edge)
 objects=list(set(bpy.data.objects)-before)
 if interactive:
  empty=bpy.data.objects.new(name,None);S.collection.objects.link(empty);empty.location=center
  for o in objects:o.parent=empty;o.matrix_parent_inverse=empty.matrix_world.inverted()
  empty['place']='plant';plant_data.append({'name':name,'center':center,'size':size})
 return objects

# Broad, lush terrain. The river winds through it and drops over the foreground rim.
ground=ellipse_points(0,0,18.6,16,80,.027)
patch('Low rocky escarpment',ground,-.05,1.5,rock,'#6b795d')
patch('Earth layer',ground,.16,.42,soil)
patch('Lush ground',ground,.33,.25,grass,'#74a72e')
for i in range(65):
 a=i*2*pi/65;x=18*cos(a);y=15.4*sin(a)
 uvball('Mossy rim',(x,y,-.36),(random.uniform(.4,.9),.55,random.uniform(.3,.65)),rock,12,.10,'#758368')

riverpaths=[]
def catmull(points,n=160):
 out=[]
 p=[points[0]]+points+[points[-1]]
 for k in range(len(points)-1):
  a,b,c,d=[Vector(v) for v in p[k:k+4]]
  for j in range(max(8,n//(len(points)-1))):
   t=j/max(8,n//(len(points)-1));q=.5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t);out.append(q)
 out.append(Vector(points[-1]));return out
def river(name,points,width):
 path=catmull(points);vs=[];fs=[];banks=[[],[]]
 for i,p in enumerate(path):
  d=path[min(i+1,len(path)-1)]-path[max(0,i-1)];d.normalize();n=Vector((-d.y,d.x));w=width*(1+.07*sin(i*.11))
  for side in [-1,1]:
   v=p+n*w*.5*side;vs.append((v.x,v.y,.365));banks[(side+1)//2].append((v.x,v.y,.38))
  if i<len(path)-1:fs.append((2*i,2*i+1,2*i+3,2*i+2))
 obj_mesh(name,vs,fs,water)
 for bank in banks:
  tube('River bank',bank,.07,trim)
  for i in range(0,len(bank),8):
   x,y,z=bank[i];uvball('Bank stone',(x,y,z),(.12,.16,.075),stone,8)
 riverpaths.append({'points':points,'width':width})
river('Main river',[(0,6),(0,1),(-1,-3),(-4,-7),(-4.8,-10),(-7,-15)],2.35)
river('Western stream',[(-16,5),(-11,4),(-6,2),(0,1)],1.3)
river('Eastern stream',[(11,7),(9,3),(6,1),(2,-2),(-1,-3)],1.3)

# Uneven layered limestone and soft moss under the central fountain.
for rad,z,h in [(5.5,.38,2.65),(4.05,2.9,2.2)]:
 pts=ellipse_points(0,5.5,rad,rad*.86,64,.026)
 patch('Sculpted waterfall bluff',pts,z+h,h,rock,'#5a735d')
 patch('Overhanging moss turf',ellipse_points(0,5.5,rad*1.01,rad*.87,64,.025),z+h+.12,.22,grass,'#649c31')
 for i in range(25):
  a=i/25*2*pi;x=cos(a)*rad;y=5.5+sin(a)*rad*.86
  uvball('Cascading moss',(x,y,z+h-.06),(random.uniform(.32,.65),.45,.2),foliage,12,.05,'#70a52a')
patch('Upper water mirror',ellipse_points(0,5.5,3.75,3.1),5.26,.025,water)
patch('Lower water mirror',ellipse_points(0,5.5,5.3,4.35),3.19,.025,water)
falls=[]
def waterfall(name,x,y,z,h,w,angle=0):
 vs=[];fs=[];U=12;V=22
 for j in range(V+1):
  t=j/V
  for i in range(U+1):
   u=i/U-.5;cross=u*w*(.87+.18*t);out=.12*sin(t*pi)+.15*t*t+.022*sin(i*3+j*.2)
   vs.append((x+cross*cos(angle)+out*sin(angle),y+cross*sin(angle)-out*cos(angle),z-h*t))
   if j<V and i<U:n=j*(U+1)+i;fs.append((n,n+1,n+U+2,n+U+1))
 o=obj_mesh(name,vs,fs,fallMat);o['flow']=1
 for i in range(6):
  u=(i/5-.5)*w*.9;pts=[]
  for j in range(20):
   t=j/19;out=.12*sin(t*pi)+.15*t*t+.027;pts.append((x+u*cos(angle)+out*sin(angle),y+u*sin(angle)-out*cos(angle),z-h*t))
  tube('White water ribbon',pts,random.uniform(.009,.025),foam)
 for i in range(6):
  u=(i/5-.5)*w;uvball('Soft splash',(x+u*cos(angle)+.2*sin(angle),y+u*sin(angle)-.2*cos(angle),z-h+.045),(.16,.13,.075),foam,10)
 falls.append({'x':x,'y':y,'z':z,'height':h,'width':w,'angle':angle})
for rad,z,h,count in [(4,5.26,2.03,9),(5.5,3.23,2.86,12)]:
 for i in range(count):
  a=i/count*2*pi+.16;x=sin(a)*rad;y=5.5-cos(a)*rad*.86
  waterfall('Silken waterfall',x,y,z,h,random.uniform(.4,.85),a)
waterfall('River edge falls',-7,-15.25,.37,1.65,2.25,0)
cabbage('Cabbage heart',(0,5.5,5.3),2.6,1)

# Architectural helpers: bevels, trim, layered roofs, readable physical signage.
font=bpy.data.fonts.load('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf')
serif=bpy.data.fonts.load('/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf')
def text(name,body,loc,size,material,font_=None):
 c=bpy.data.curves.new(name,'FONT');c.body=body;c.size=size;c.align_x='CENTER';c.align_y='CENTER';c.extrude=.001;c.bevel_depth=.0007;c.font=font_ or font;o=bpy.data.objects.new(name,c);S.collection.objects.link(o);o.location=loc;o.rotation_euler=(pi/2,0,0);c.materials.append(material);return o
def sign(body,x,y,z,w,font_=None):
 cube(body+' sign frame',(x,y,z),(w,.18,.77),cedar,.08);cube(body+' sign',(x,y-.108,z),(w-.15,.035,.61),dark,.035);text(body,body,(x,y-.14,z),min(.43,w/len(body)*1.52),cream,font_)
def planks(x,y,z,w,d):
 for i in range(int(w/.28)):
  cube('Wooden floorboard',(x-w/2+.16+i*.28,y,z),(.258,d,.12),cedar,.017)
def roof(x,y,z,w,d,m=steel):
 cube('Deep eave',(x,y,z),(w,d,.17),wood,.06);cube('Standing seam roof',(x,y,z+.14),(w+.14,d+.12,.18),m,.055)
 for i in range(int(w/.4)):cube('Roof standing seam',(x-w/2+.2+i*.4,y,z+.25),(.035,d+.08,.055),paleSteel,.012)
def step(x,y,w):
 for i in range(2):cube('Entry step',(x,y-.22*i,.26-.07*i),(w,.45,.15),stone,.05)

# The book kiosk has an open counter, individual books, printed papers and a canvas awning.
x,y=-9,1.0
cube('Bookshop stone plinth',(x,y,.48),(4.55,3.4,.32),slate,.10)
cube('Bookshop rear wall',(x,y+1.45,1.93),(4.15,.19,2.9),slate,.05)
cube('Bookshop side wall',(x-2.05,y,1.93),(.18,2.9,2.9),slate,.05)
for xx in [-2.1,2.1]:cube('Bookshop timber post',(x+xx,y-1.46,2.02),(.19,.19,3.2),wood)
roof(x,y,3.64,4.8,3.6);sign('escape-the-void',x,y-1.83,3.45,4.6)
bookM=[mat('Book spine '+str(i),c) for i,c in enumerate(['#ce8c3a','#456f78','#dfbf6c','#737c35','#9c583c','#abc198'])]
for z in [1.0,1.72,2.45]:
 cube('Bookshelf',(x,y+1.15,z),(3.7,.57,.1),cedar)
 for k in range(18):
  h=random.uniform(.34,.59);xx=x-1.72+k*.195
  cube('Bound volume',(xx,y+1.14,z+h/2+.05),(.145,.32,h),bookM[k%6],.009)
  for stripe in [.14,.8]:cube('Book spine gilt',(xx,y+.972,z+.07+h*stripe),(.11,.009,.017),trim,.002)
cube('Bookshop front stone',(x,y-1.4,.94),(4.2,.35,.85),slate,.04);cube('Bookshop counter',(x,y-1.3,1.42),(4.55,.93,.16),cedar,.06)
for row in range(3):
 for col in range(8):cube('Bookshop masonry',(x-1.85+col*.52+(row%2)*.13,y-1.59,.62+row*.25),(.48,.022,.205),stone,.014)
for j in range(7):cube('Newspaper stack',(x+1.15,y-1.35,1.55+j*.032),(.64,.53,.025),paper,.008)
text('Newspaper headline','THE LEAF',(x+1.15,y-1.635,1.74),.084,dark)
step(x,y-1.95,2.2)

# Music pavilion: wood joinery, railings, worn record cabinet, curved brass horn.
x,y=-10,-7.2
planks(x,y,.49,4.9,4.0)
for xx in [-2.25,2.25]:
 for yy in [-1.77,1.77]:cube('Music pavilion post',(x+xx,y+yy,2.02),(.22,.22,3.18),wood,.035)
cube('Music back panel',(x,y+1.85,1.81),(4.55,.15,2.62),steel)
roof(x,y,3.72,5.1,4.3);sign('compose boredom',x,y-2.19,3.47,4.98,serif)
for xx in [-2.25,2.25]:
 cube('Balustrade handrail',(x+xx,y,1.4),(.2,3.4,.12),cedar)
 for j in range(9):cube('Balustrade spindle',(x+xx,y-1.52+j*.38,.99),(.075,.075,.77),wood,.01)
step(x,y-2.25,2.65)
cube('Record cabinet',(x-.4,y,.94),(1.42,1.1,.85),wood,.055)
cube('Record cabinet top',(x-.4,y,1.42),(1.65,1.27,.16),cedar,.05)
for zz in [.72,1.08]:
 cube('Cabinet drawer',(x-.4,y-.572,zz),(1.23,.035,.25),wood,.02)
 cube('Brass drawer handle',(x-.4,y-.61,zz),(.25,.035,.028),gold,.01)
cylinder('Vinyl record',(x-.4,y,1.525),.53,.036,dark,64)
cylinder('Record label',(x-.4,y,1.55),.17,.017,trim,32)
tube('Gramophone neck',[(x+.05,y+.1,1.55),(x+.4,y+.3,1.76),(x+.36,y+.36,1.98)],.065,gold)
# Horn follows a swept, widening path and has a dark inner bell.
vs=[];fs=[];N=36;H=20
for j in range(H+1):
 t=j/H;center=Vector((x+.36-t*.13,y+.36-t*.72,1.96+t*.6));radius=.075+.78*t**2.7
 for i in range(N):
  a=i/N*2*pi;vs.append(tuple(center+Vector((cos(a)*radius,sin(a)*radius*.55,sin(a)*radius*.83))))
  if j<H:n=j*N+i;fs.append((n,j*N+(i+1)%N,(j+1)*N+(i+1)%N,n+N))
obj_mesh('Flared brass gramophone horn',vs,fs,gold)
tube('Gramophone rolled lip',[tuple(Vector((x+.23,y-.36,2.56))+Vector((cos(i/N*2*pi)*.855,sin(i/N*2*pi)*.855*.55,sin(i/N*2*pi)*.855*.83))) for i in range(N)],.035,gold,True)
text('Music wall note','♪',(x+1.1,y+1.73,2.12),1.02,cream,serif)

# Nerd's farm: carefully framed glazing, server racks, rooftop greenhouse pods.
x,y=8.0,0.0
cube('Lab plinth',(x,y,.5),(5.05,4.0,.32),stone,.12)
cube('Lab shell',(x,y,2.12),(4.65,3.6,3.15),slate,.08)
cube('Lab dark front',(x,y-1.815,2.1),(4.32,.08,2.85),dark,.025)
for xx in [-2.18,-.75,.75,2.18]:cube('Lab glazed mullion',(x+xx,y-1.92,2.09),(.09,.14,2.95),paleSteel,.014)
for xx in [-1.47,0,1.47]:cube('Lab glazed pane',(x+xx,y-1.89,2.09),(1.32,.03,2.78),glass,.006)
for xx in [-1.46,1.46]:
 cube('Server rack',(x+xx,y-1.6,2.04),(1.13,.27,2.68),dark)
 for j in range(10):
  cube('Server blade',(x+xx,y-1.78,.87+j*.24),(.96,.07,.16),slate,.016)
  for k in range(2):cube('Server LED',(x+xx-.34+k*.1,y-1.83,.87+j*.24),(.025,.015,.035),glow,.003)
  for k in range(7):cube('Server ventilation',(x+xx-.04+k*.055,y-1.824,.87+j*.24),(.015,.007,.07),dark,.001)
for xx in [-.2,.2]:cube('Door handle',(x+xx,y-2.0,1.93),(.035,.04,.47),trim,.009)
roof(x,y,3.79,5.1,4.05,slate);sign("nerd's farm",x,y-2.1,3.7,5.0)
step(x,y-2.27,2)

# The gallery is light and open, with a clerestory, frames and the original world drawing.
x,y=10,-7.1
cube('Gallery plinth',(x,y,.5),(5.1,3.95,.28),stone,.10)
cube('Gallery rear plaster',(x,y+1.64,2.0),(4.72,.2,2.97),cream,.05)
for xx in [-2.34,2.34]:cube('Gallery flank',(x+xx,y,2.0),(.18,3.45,2.97),cream,.04)
roof(x,y,3.57,5.1,3.92,cream);sign('my-world-in-XD',x,y-2.01,3.54,5.02)
for xx in [-2.24,-.78,.78,2.24]:cube('Gallery frame',(x+xx,y-1.76,1.98),(.095,.1,2.95),steel,.014)
for xx in [-1.5,1.5]:cube('Gallery glass',(x+xx,y-1.75,1.98),(1.34,.033,2.8),glass,.008)
for xx in [-.2,.2]:cube('Gallery handle',(x+xx,y-1.8,1.83),(.035,.05,.45),gold,.008)
image=bpy.data.images.load(ROOT+'/dist/cabbageland-reference.jpeg');image.pack()
artmat=mat('Original artwork','#ffffff',.7)
nt=artmat.node_tree;node=nt.nodes.new('ShaderNodeTexImage');node.image=image;nt.links.new(node.outputs['Color'],nt.nodes.get('Principled BSDF').inputs['Base Color'])
def painting(name,x,y,z,w,h):
 cube('Picture frame',(x,y,z),(w+.16,.14,h+.16),cedar,.025)
 o=obj_mesh(name,[(x-w/2,y-.079,z-h/2),(x+w/2,y-.079,z-h/2),(x+w/2,y-.079,z+h/2),(x-w/2,y-.079,z+h/2)],[(0,1,2,3)],artmat)
 uv=o.data.uv_layers.new(name='UVMap')
 for l,co in zip(uv.data,[(0,0),(1,0),(1,1),(0,1)]):l.uv=co
painting('Reference artwork',x,y+1.49,2.05,2.9,1.93)
painting('Miniature on easel',x+3,y-2,1.43,.9,.62)
for xx in [-.32,.32]:bar('Easel leg',(x+3+xx,y-2,.35),(x+3+xx*.7,y-1.93,2.04),.035,wood)
bar('Easel rear leg',(x+3,y-1.54,.35),(x+3,y-1.92,2.04),.035,wood)
step(x,y-2.12,2.2)

print('ARCHITECTURE_COMPLETE',flush=True)

# Glass conservatories have actual curved panes, nested latitude rings and masonry sills.
def dome(x,y,z,r):
 cylinder('Conservatory sill',(x,y,z+.1),r*1.035,.2,steel,48)
 vs=[];fs=[];U=40;V=12
 for j in range(V+1):
  p=j/V*pi/2
  for i in range(U):
   a=i/U*2*pi;vs.append((x+cos(a)*cos(p)*r,y+sin(a)*cos(p)*r,z+sin(p)*r*.77))
   if j<V:fs.append((j*U+i,j*U+(i+1)%U,(j+1)*U+(i+1)%U,(j+1)*U+i))
 obj_mesh('Curved conservatory glazing',vs,fs,glass)
 for i in range(16):
  a=i/16*2*pi;tube('Conservatory meridian',[(x+cos(a)*cos(j/24*pi/2)*r,y+sin(a)*cos(j/24*pi/2)*r,z+sin(j/24*pi/2)*r*.77) for j in range(25)],.032,paleSteel)
 for h in [.26,.50,.72,.89]:
  rr=sqrt(1-h*h)*r;tube('Conservatory latitude',[(x+cos(j/64*2*pi)*rr,y+sin(j/64*2*pi)*rr,z+h*r*.77) for j in range(64)],.032,paleSteel,True)
 cube('Conservatory door',(x,y-r-.03,z+.72),(.9,.08,1.35),steel,.03)
 cube('Conservatory door window',(x,y-r-.079,z+.87),(.75,.025,.96),glass,.012)
dome(-13.0,7.4,.40,3.75);dome(12.65,7.7,.40,3.75)
dome(6.85,.35,4.06,1.10);dome(9.28,.40,4.06,.85)

# Giant branching steel canopies repeat the leaf-vein language above the whole garden.
def canopy(x,y,h,r):
 cylinder('Supertree fluted trunk',(x,y,.4+h*.29),.35,h*.58,steel,14,r2=.22)
 for i in range(14):
  a=i/14*2*pi;pts=[]
  for j in range(35):
   t=j/34;rr=.25+(r-.25)*t**2.7;zz=.4+h*(.35+.65*t**.77);pts.append((x+cos(a)*rr,y+sin(a)*rr,zz))
  tube('Supertree radial rib',pts,.065,steel)
 for t in [.40,.60,.77,.9,1]:
  rr=.25+(r-.25)*t**2.7;zz=.4+h*(.35+.65*t**.77)
  tube('Supertree structural ring',[(x+cos(i/80*2*pi)*rr,y+sin(i/80*2*pi)*rr,zz) for i in range(80)],.043,paleSteel,True)
 vs=[];fs=[];U=56;V=12
 for j in range(V+1):
  t=.30+.70*j/V;rr=.25+(r-.25)*t**2.7;zz=.4+h*(.35+.65*t**.77)-.045
  for i in range(U):
   a=i/U*2*pi;vs.append((x+cos(a)*rr,y+sin(a)*rr,zz))
   if j<V:fs.append((j*U+i,j*U+(i+1)%U,(j+1)*U+(i+1)%U,(j+1)*U+i))
 obj_mesh('Supertree translucent canopy',vs,fs,glass)
canopy(-12.5,12,13.5,7.8);canopy(12.0,12.5,14.2,8.1)
# An open arch across the back keeps the silhouette coherent from other angles.
tube('Garden arch',[(-18*cos(j/64*pi),11.5,4+13*sin(j/64*pi)) for j in range(65)],.12,steel)

def blade(name,loc,size,angle,m=foliage,color='#4e952d'):
 # Curved lanceolate leaf, with a quiet fold down the midrib.
 vs=[];fs=[];cols=[]
 for j in range(9):
  v=j/8
  for u in [-1,0,1]:
   w=sin(pi*v)**.75*.32*size*u;long=v*size;z=sin(pi*v)*size*.12+abs(u)*size*.06
   vs.append((loc[0]+cos(angle)*long-sin(angle)*w,loc[1]+sin(angle)*long+cos(angle)*w,loc[2]+z));cols.append(tuple(c*(.86+.15*v) for c in rgb(color)))
  if j<8:
   for i in range(2):n=j*3+i;fs.append((n,n+1,n+4,n+3))
 return obj_mesh(name,vs,fs,m,cols)
def shrub(x,y,z,s,col='#458b27',detail=True):
 uvball('Sculpted foliage crown',(x,y,z),(s,s*.88,s*.8),foliage,16,.1,col)
 if detail:
  for i in range(14):
   a=random.uniform(0,2*pi);p=random.uniform(.1,pi*.85);xx=x+cos(a)*sin(p)*s*.85;yy=y+sin(a)*sin(p)*s*.83;zz=z+cos(p)*s*.7
   blade('Individual crown leaf',(xx,yy,zz),random.uniform(.35,.62),a,foliage,col)
def tree(x,y,s):
 cylinder('Living tree trunk',(x,y,.4+1.3*s),.17*s,2.6*s,bark,9,r2=.10*s)
 for i in range(5):
  a=i*2.4;xx=x+cos(a)*.75*s;yy=y+sin(a)*.67*s;zz=.4+(2.6+(i%2)*.7)*s
  bar('Tree branch',(x,y,1.5*s),(xx,yy,zz),.075*s,bark);shrub(xx,yy,zz,1.0*s,['#30772b','#4b912b','#589c2b','#73ad2d'][i%4])
for i in range(23):
 a=pi*.06+i/(22)*pi*.89;x=cos(a)*17;y=sin(a)*14.2
 tree(x,y,random.uniform(.85,1.25))
for x,y,s in [(-16,-1,1.1),(-16.4,-7,1.05),(-14,-12,1.0),(16,-2,.9),(16.2,-7,1.05),(14.7,-12,.8)]:tree(x,y,s)
for i in range(30):
 a=i/30*2*pi;x=cos(a)*16.7;y=sin(a)*14.2
 shrub(x,y,.85,random.uniform(.55,.95),['#42892b','#62a32c','#79ad2e'][i%3],True)
# Framing vines climb the massive back arch.
for side in [-1,1]:
 for i in range(12):
  t=.1+i/11*.65;x=side*18*cos(t*pi/2);z=4+13*sin(t*pi/2)
  shrub(x,11.6,z,random.uniform(.35,.65),'#3f832a',False)

# Neatly edged seedbeds and mature cabbages connect the foreground to the central monument.
def seedbed(x,y,w,d,rows,cols):
 cube('Seedbed dark soil',(x,y,.41),(w,d,.16),soil,.14)
 for side in [-1,1]:cube('Seedbed timber edge',(x,y+side*d/2,.46),(w+.1,.09,.18),wood,.03)
 for side in [-1,1]:cube('Seedbed timber end',(x+side*w/2,y,.46),(.09,d,.18),wood,.03)
 for i in range(rows):
  yy=y+(i-(rows-1)/2)*d/rows
  for j in range(cols):
   xx=x+(j-(cols-1)/2)*w/cols;s=random.uniform(.34,.47)
   cabbage('Plant_'+str(len(plant_data)),(xx,yy,.50),s,0,True)
seedbed(-6,-1.5,5.9,3.3,2,4);seedbed(3,-5.4,5.0,3.1,2,3);seedbed(4.4,-11.9,6.5,2.8,1,3)
seedbed(13,3.8,2.8,2.0,1,2)
cube('Giant seedbed',(4,-8.9,.43),(5.0,3.5,.2),soil,.18)
cabbage('Plant_'+str(len(plant_data)),(4,-8.9,.55),1.45,1,True)
for x,y in [(-13,7.8),(-11.7,8),(12,7.9),(13.4,8.3)]:cabbage('Greenhouse cabbage',(x,y,.55),.50,0)

def path(points,w):
 for p,q in zip(points,points[1:]):
  a=Vector(p);b=Vector(q);length=(b-a).length;n=math.ceil(length/.76)
  for i in range(n):
   p=a.lerp(b,(i+.5)/n);o=cube('Hand laid paving',(p.x,p.y,.41),(w,length/n-.065,.085),stone,.045);o.rotation_euler.z=-math.atan2(b.x-a.x,b.y-a.y)
path([(6,-2.4),(6,-4),(8,-5),(10,-9.5),(11,-12.5)],1.16)
path([(-12.5,-3),(-12.5,-5),(-12.5,-10),(-10,-11)],.9)
path([(1,-4),(1,-7),(.5,-10),(1.2,-12)],.86)
def bridge(x,y,angle):
 def p(a,b,z):return (x+cos(angle)*a-sin(angle)*b,y+sin(angle)*a+cos(angle)*b,z)
 for i in range(15):
  a=(i-7)*.24;z=.60+.28*cos(a/2*pi/2);o=cube('Bridge decking',p(a,0,z),(.216,1.68,.12),cedar,.018);o.rotation_euler.z=angle
 for side in [-1,1]:
  for a in [-1.65,-.83,0,.83,1.65]:bar('Bridge post',p(a,side*.75,.60),p(a,side*.75,1.44+.25*cos(a/2*pi/2)),.045,wood)
  tube('Arched bridge handrail',[p(a,side*.75,1.50+.25*cos(a/2*pi/2)) for a in [-1.7,-1.3,-.9,-.45,0,.45,.9,1.3,1.7]],.045,wood)
bridge(-2.3,-4.5,.55);bridge(5,0,-.55)
def bench(x,y,angle):
 def p(a,b,z):return (x+cos(angle)*a-sin(angle)*b,y+sin(angle)*a+cos(angle)*b,z)
 for yy in [-.25,0,.25]:
  o=cube('Bench slat',p(0,yy,.9),(2.3,.21,.09),cedar,.025);o.rotation_euler.z=angle
 for z in [1.23,1.55]:
  o=cube('Bench back slat',p(0,.34,z),(2.3,.10,.20),cedar,.025);o.rotation_euler.z=angle
 for xx in [-.88,.88]:
  for yy in [-.2,.27]:bar('Bench legs',p(xx,yy,.33),p(xx,yy,.9),.06,steel)
  bar('Bench back support',p(xx,.34,.76),p(xx,.34,1.64),.045,steel)
bench(-7.9,-11,-.15)

# The gardener is a tiny character, with a woven straw hat and a watering can.
x,y=-.3,-7.3
skin=mat('Gardener skin','#eac08a');shirt=mat('Gardener shirt','#e5ad40')
for xx in [-.14,.14]:
 cube('Gardener trouser',(x+xx,y,.74),(.22,.25,.60),navy,.07);cube('Gardener boot',(x+xx,y-.09,.46),(.25,.40,.19),wood,.07)
uvball('Gardener torso',(x,y,1.16),(.32,.23,.43),shirt,16)
cube('Dungaree bib',(x,y-.22,1.14),(.4,.04,.40),navy,.04)
for xx in [-.13,.13]:cube('Dungaree strap',(x+xx,y-.2,1.41),(.06,.055,.30),navy,.018)
uvball('Gardener head',(x,y,1.78),(.26,.23,.31),skin,20)
for xx in [-.085,.085]:uvball('Eyes',(x+xx,y-.227,1.82),(.021,.02,.028),dark,10)
cylinder('Straw brim',(x,y,2.02),.51,.065,trim,48);cylinder('Straw hat crown',(x,y,2.14),.28,.24,trim,32,r2=.24)
torus('Hat ribbon',(x,y,2.07),.277,.029,wood)
for xx in [-.37,.37]:bar('Gardener arm',(x+xx*.8,y,1.4),(x+xx,y-.07,1.0),.09,shirt);uvball('Hand',(x+xx,y-.07,.98),(.10,.10,.12),skin,12)
cylinder('Watering can',(x+.52,y-.08,.75),.18,.32,paleSteel,20)
tube('Can handle',[(x+.39,y-.08,.85),(x+.37,y-.08,1.08),(x+.65,y-.08,1.08),(x+.67,y-.08,.85)],.028,steel)
bar('Can spout',(x+.63,y-.08,.72),(x+.9,y-.08,.95),.048,paleSteel)

# Ferns, grass tufts, flowers, lilies and toadstools create detail at human scale.
for i in range(130):
 a=random.uniform(0,2*pi);rr=random.uniform(.83,.99);x=cos(a)*17.4*rr;y=sin(a)*14.9*rr
 for j in range(4):blade('Grass blade',(x,y,.34),random.uniform(.17,.43),j*1.6,foliage,'#6fa032')
 if i%3==0:
  bar('Wildflower stem',(x,y,.34),(x,y,.73),.012,foliage)
  for k in range(5):uvball('Flower petal',(x+cos(k/5*2*pi)*.06,y+sin(k/5*2*pi)*.06,.76),(.047,.047,.025),flowerM[i%3],8)
  uvball('Flower center',(x,y,.78),(.035,.035,.025),gold,8)
for i in range(15):
 x=random.uniform(-13,-8);y=random.uniform(-12.5,-10)
 cylinder('Mushroom stem',(x,y,.45),.035,.19,cream,8);uvball('Mushroom cap',(x,y,.58),(.13,.13,.08),orange,12)
for x,y in [(-1,1.8),(-2.6,-4.9),(-5.5,-10.7),(8,1.7),(-9,3.8)]:
 cylinder('Lily pad',(x,y,.383),.23,.012,leafMat,24)
for x,y in [(-5,-4.4),(6,-2.5),(8,-9.9),(-7.3,-10.7),(-10,3.2),(12,1.8)]:
 cylinder('Lamp post',(x,y,1.42),.045,2.1,steel,10)
 cube('Lantern',(x,y,2.4),(.35,.35,.47),dark,.025)
 cube('Lantern glow',(x,y-.183,2.40),(.22,.025,.32),glow,.018)
 cylinder('Lantern roof',(x,y,2.7),.29,.15,steel,4,r2=.045)

# A few curved birds and distant soft clouds complete the sky.
for i,(x,y,z) in enumerate([(-8,5,7.7),(6,5,9),(11,-1,6.1)]):
 uvball('Songbird',(x,y,z),(.2,.12,.15),orange,16)
 for side in [-1,1]:tube('Bird wing',[(x+side*.1,y,z),(x+side*.32,y+.035,z+.15),(x+side*.5,y+.09,z+.10)],.054,slate)
cloud=mat('Cloud','#eef8f6')
for x,y,z,ss in [(-18,25,16,1.6),(-4,26,18,1.5),(7,28,18.5,1.3),(20,27,16,1.7)]:
 for i in range(5):uvball('Soft cumulus',(x+(i-2)*ss*.65,y,z+sin(i*1.9)*.35),(ss,ss*.55,ss*.55),cloud,16)

print('SCENE_COMPLETE objects',len(bpy.data.objects),flush=True)
# All renderable objects are baked to actual meshes. Static geometry is grouped by
# material, while growing cabbages retain named parents for the web interaction.
bpy.ops.object.select_all(action='DESELECT')
for o in S.objects:
 if o.type in {'MESH','CURVE','FONT'}:o.select_set(True)
bpy.context.view_layer.objects.active=next(o for o in S.objects if o.type=='MESH')
bpy.ops.object.convert(target='MESH')
# Give vertex colors to objects sharing color-aware materials but without attributes.
for o in list(S.objects):
 if o.type=='MESH' and o.data.materials and o.data.materials[0] in [foliage,leafMat,rock,grass] and not o.data.color_attributes:
  ma=o.data.materials[0];attr=o.data.color_attributes.new(name='Col',type='FLOAT_COLOR',domain='POINT');co=ma.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value
  for a in attr.data:a.color=co
bpy.context.view_layer.update()
groups={}
for o in list(S.objects):
 if o.type!='MESH':continue
 # Each interactive parent is batched separately. Transparent glazing remains isolated.
 key=(o.parent.name if o.parent else 'WORLD',o.data.materials[0].name if o.data.materials else '')
 groups.setdefault(key,[]).append(o)
for (parent,material),objects in groups.items():
 bpy.ops.object.select_all(action='DESELECT')
 for o in objects:o.select_set(True)
 bpy.context.view_layer.objects.active=objects[0]
 if len(objects)>1:bpy.ops.object.join()
 o=bpy.context.view_layer.objects.active;o.name=parent+'__'+material
print('BATCHED',len([o for o in S.objects if o.type=='MESH']),flush=True)

# Orthographic editorial view: a much closer garden, with minimal empty framing.
def area(name,loc,power,size,color):
 d=bpy.data.lights.new(name,'AREA');d.energy=power;d.shape='DISK';d.size=size;d.color=rgb(color);o=bpy.data.objects.new(name,d);S.collection.objects.link(o);o.location=loc;o.rotation_euler=(Vector((0,0,3))-o.location).to_track_quat('-Z','Y').to_euler()
area('Warm sun',(-10,-16,26),2500,9,'#fff2d1');area('Sky fill',(12,3,20),1700,12,'#c2e8ff')
sunD=bpy.data.lights.new('Sun','SUN');sunD.energy=2;sunD.angle=.12;sun=bpy.data.objects.new('Sun',sunD);S.collection.objects.link(sun);sun.rotation_euler=(.45,-.4,-.3)
camD=bpy.data.cameras.new('Garden camera');cam=bpy.data.objects.new('Garden camera',camD);S.collection.objects.link(cam);cam.location=(13,-31,21);target=Vector((0,1.1,4.4));cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();camD.type='ORTHO';camD.ortho_scale=39;camD.lens=45;S.camera=cam
S.render.image_settings.file_format='PNG';S.render.filepath='/workspace/scratch/0a613ed0966c/blender-renders/cabbageland-v2.png'
bpy.ops.wm.save_as_mainfile(filepath=ROOT+'/blender/Cabbageland.blend',compress=True)
print('SAVED_BLEND',flush=True)
bpy.ops.export_scene.gltf(filepath=OUT+'/cabbageland.glb',export_format='GLB',use_selection=False,export_apply=True,export_cameras=False,export_lights=False,export_extras=True,export_yup=True,export_animations=False,export_materials='EXPORT',export_image_format='AUTO')
with open(OUT+'/world-data.json','w') as f:json.dump({'plants':plant_data,'falls':falls,'rivers':riverpaths,'camera':list(cam.location),'target':list(target)},f)
print('EXPORTED_GLB',os.path.getsize(OUT+'/cabbageland.glb'),flush=True)
bpy.ops.render.render(write_still=True)
print('RENDER_COMPLETE',flush=True)
