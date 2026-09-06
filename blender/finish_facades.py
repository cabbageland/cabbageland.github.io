import bpy,os,math
from mathutils import Vector
from math import pi
ROOT='/workspace/sites/cabbageland'
bpy.ops.wm.open_mainfile(filepath=ROOT+'/blender/Cabbageland.blend')
S=bpy.context.scene
code=open(ROOT+'/blender/build_world.py').read();exec(code[code.index('def rgb(h):'):code.index('grass=mat(')],globals());exec(code[code.index('def obj_mesh('):code.index('plant_data=[]')],globals())
dark=bpy.data.materials['Deep forest'];slate=bpy.data.materials['Blue slate'];pale=bpy.data.materials['Pale steel'];glow=bpy.data.materials['Lamplight'];cedar=bpy.data.materials['Honey cedar'];artmat=bpy.data.materials['Original artwork']
# Visible rack bays are inset between the existing door frames.
for xx in [6.54,9.46]:
 cube('Visible server bay',(xx,-1.975,2.04),(1.17,.055,2.56),dark,.025)
 for j in range(10):
  zz=.87+j*.24;cube('Visible server blade',(xx,-2.016,zz),(1.02,.035,.175),slate,.012)
  for k in range(2):cube('Front status light',(xx-.37+k*.09,-2.042,zz),(.027,.018,.034),glow,.003)
  for k in range(9):cube('Front vent',(xx-.09+k*.048,-2.037,zz),(.017,.009,.085),dark,.002)
 for side in [-1,1]:cube('Rack vertical trim',(xx+side*.57,-2.043,2.04),(.032,.025,2.61),pale,.006)
# Two works in the gallery's front display, with glass doors between them.
exec(code[code.index('def painting('):code.index("painting('Reference artwork'")],globals())
painting('Gallery front display',8.52,-8.91,2.02,1.17,1.52)
painting('Gallery second display',11.48,-8.91,2.02,1.17,1.52)
# Keep the same compact grouping after the final facade detail pass.
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
bpy.ops.wm.save_as_mainfile(filepath=ROOT+'/blender/Cabbageland.blend',compress=True)
bpy.ops.export_scene.gltf(filepath=ROOT+'/dist/models/cabbageland.glb',export_format='GLB',export_apply=True,export_cameras=False,export_lights=False,export_extras=True,export_yup=True,export_animations=False,export_draco_mesh_compression_enable=True,export_draco_mesh_compression_level=6)
S.render.filepath='/workspace/scratch/0a613ed0966c/blender-renders/cabbageland-final.png'
bpy.ops.render.render(write_still=True)
print('FINAL_COMPLETE',flush=True)
