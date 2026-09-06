# Cabbageland Blender scene

The authored scene is `Cabbageland.blend`, created in Blender 4.3.2. It includes the complete garden, named interactive cabbage parents, physical lettering, packed artwork, materials, lights, and the proof-render camera.

`Cabbageland-render.png` is a Cycles render of the authored model. The interactive site loads `dist/models/cabbageland.glb`, a Draco-compressed export. It uses live WebGL lighting and animated water, so its illumination differs from the Cycles proof.

To rebuild from source, run the scripts in order in Blender's background mode:

1. `build_world.py` generates the initial full scene.
2. `refine_world.py` fixes plant pivots, refines the silhouette and rockwork, and compresses the export.
3. `finish_facades.py` finishes the server bays and gallery displays, saves the source, and exports the final model.

The scripts use the checkout path `/workspace/sites/cabbageland`. Adjust `ROOT` and render output paths if using another machine. Run refinements after a fresh base build, as the refinement steps edit the current scene.

Validation completed: JavaScript syntax, local module and decoder paths, complete native Draco decoding of all 59 mesh primitives, and 20 interactive plant nodes. The scene was inspected through actual Blender Cycles renders; no browser visual test was performed.
