import bpy, math, random, json, os
from mathutils import Vector,Matrix
from math import sin,cos,pi
ROOT='/workspace/sites/cabbageland'
bpy.ops.wm.open_mainfile(filepath=ROOT+'/blender/Cabbageland.blend')
S=bpy.context.scene
# Load only modeling helpers; do not clear or rebuild the saved project.
code=open(ROOT+'/blender/build_world.py').read()
ns=globals();exec(code[code.index('def rgb(h):'):code.index('grass=mat(')],ns)
exec(code[code.index('def obj_mesh('):code.index('plant_data=[]')],ns)
rock=bpy.data.materials['Weathered limestone'];foliage=bpy.data.materials['Canopy foliage'];fallMat=bpy.data.materials['Waterfall'];foam=bpy.data.materials['Water foam'];vein=bpy.data.materials['Leaf veins'];edge=bpy.data.materials['Leaf margins']
# Correct each plant's pivot while preserving its local model coordinates.
for parent in S.objects:
 if parent.get('place')=='plant':
  for child in parent.children:child.matrix_parent_inverse=Matrix.Translation(-parent.location)
# The central cabbage needs a broad, compressed silhouette, like the reference.
for o in list(S.objects):
 if o.type=='MESH' and o.name.startswith('WORLD__') and o.data.materials[0].name in ['Living cabbage leaf','Leaf veins','Leaf margins']:
  inv=o.matrix_world.inverted()
  for v in o.data.vertices:
   p=o.matrix_world@v.co
   if p.z>5.25 and -5<p.x<5 and 1<p.y<10:
    p.x*=1.11;p.y=5.5+(p.y-5.5)*1.11;p.z=5.3+(p.z-5.3)*.73;v.co=inv@p
# Replace the cylinder-like cliff silhouette with irregular, overlaid stone faces.
random.seed(592)
for rad,z,h in [(5.45,.37,2.67),(3.94,3.0,2.18)]:
 for i in range(31):
  a=i/31*2*pi+random.uniform(-.04,.04);x=cos(a)*rad;y=5.5+sin(a)*rad*.86
  uvball('Layered cliff outcrop',(x,y,z+h*.43),(random.uniform(.38,.66),random.uniform(.3,.54),random.uniform(.65,1.13)),rock,12,.13,'#63765a')
  if i%2==0:uvball('Moss drape',(x,y,z+h-.12),(random.uniform(.5,.8),.48,random.uniform(.17,.29)),foliage,12,.09,'#64972a')
# Broader foreground curtains of water flow over the irregular rocks.
falls=json.load(open(ROOT+'/dist/models/world-data.json'))['falls']
exec(code[code.index('def waterfall('):code.index('for rad,z,h,count')],ns)
for a,w in [(-.30,1.0),(.27,1.25),(1.05,.8),(-1.15,.8)]:
 waterfall('Broad upper cascade',sin(a)*4.02,5.5-cos(a)*3.49,5.26,2.05,w,a)
 waterfall('Broad lower cascade',sin(a)*5.58,5.5-cos(a)*4.86,3.22,2.85,w*1.1,a)
# Thicken the back crowns and add leafy volume at the canopy edges.
for side in [-1,1]:
 for i in range(18):
  a=.15+i/17*1.55;xx=side*(12.2+cos(a)*4.9);yy=12+sin(a)*3.8;zz=12.8+sin(a*1.8)*.65
  uvball('Canopy edge greenery',(xx,yy,zz),(random.uniform(.55,.9),.65,.34),foliage,12,.10,'#48842c')
# Place more pebbles at the main waterline to soften the engineered edges.
for i in range(24):
 a=pi+i/23*pi;x=cos(a)*5.85;y=5.5+sin(a)*5.0
 uvball('Fountain pool pebble',(x,y,.42),(.23,.18,.10),rock,10,.1,'#94a078')
# Convert refinements and consolidate only static meshes.
bpy.ops.object.select_all(action='DESELECT')
for o in S.objects:
 if o.type in {'MESH','CURVE'}:o.select_set(True)
bpy.context.view_layer.objects.active=next(o for o in S.objects if o.type=='MESH')
bpy.ops.object.convert(target='MESH')
groups={}
for o in list(S.objects):
 if o.type=='MESH' and not o.parent:groups.setdefault(o.data.materials[0].name,[]).append(o)
for name,objects in groups.items():
 bpy.ops.object.select_all(action='DESELECT')
 for o in objects:o.select_set(True)
 bpy.context.view_layer.objects.active=objects[0]
 if len(objects)>1:bpy.ops.object.join()
 bpy.context.object.name='WORLD__'+name
# Saturated clear-sky background, soft light, and a full-resolution proof render.
S.world.node_tree.nodes['Background'].inputs[0].default_value=(.19,.60,.84,1)
S.world.node_tree.nodes['Background'].inputs[1].default_value=.65
S.view_settings.exposure=.05
S.render.resolution_percentage=100;S.cycles.samples=48
S.render.filepath='/workspace/scratch/0a613ed0966c/blender-renders/cabbageland-final.png'
bpy.ops.wm.save_as_mainfile(filepath=ROOT+'/blender/Cabbageland.blend',compress=True)
bpy.ops.export_scene.gltf(filepath=ROOT+'/dist/models/cabbageland.glb',export_format='GLB',export_apply=True,export_cameras=False,export_lights=False,export_extras=True,export_yup=True,export_animations=False,export_draco_mesh_compression_enable=True,export_draco_mesh_compression_level=6)
print('GLB_BYTES',os.path.getsize(ROOT+'/dist/models/cabbageland.glb'),flush=True)
bpy.ops.render.render(write_still=True)
