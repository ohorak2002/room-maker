You are my lead software engineer and product-design collaborator for **Nested**. I am restarting an existing project with a clearer direction. Inspect the attached code, preserve useful work, and begin implementing the new foundation.

## Product goal

Nested will be a **downloadable desktop application for interior designers**. Designers are the paying customers. They will use it with their clients to plan rooms, explore furniture choices, and visualize the finished space.

The intended experience:

1. Create a client project.
2. Recreate a room using measurements or a floorplan.
3. Add doors, windows, and existing furniture.
4. Place real furniture products with correct dimensions and finishes.
5. Move furniture and explore the room interactively.
6. Save design alternatives and export presentation images.
7. Eventually share designs for client feedback and approval.

Nested is separate from CardWise.

## Existing project

The attached `room-maker-main.zip` contains a prototype originally developed with Claude Code. Its stack includes React, Vite, Three.js, and Zustand.

Treat this as a controlled restart. Preserve an untouched baseline and use an isolated branch or equivalent safe working copy.

Inspect the implementation and applicable repository instructions. Determine which room geometry, floorplan tools, placement controls, lighting, product parsing, persistence, and tests are worth retaining.

Distinguish documented features from functionality you actually verify. Avoid a wholesale rewrite without a concrete justification.

## First priority: a downloadable application

The designer’s main workspace should install and launch as a desktop application.

Assume Windows is the first target unless I tell you otherwise. State that assumption and keep future macOS support feasible.

Evaluate Electron, Tauri, or another justified approach using current official documentation. Prefer an architecture that can reuse the existing editor while supporting:

- Reliable 3D rendering.
- Native file dialogs.
- Local project saving and reopening.
- Autosave and recovery.
- Offline editing with assets already downloaded.
- A practical installer and update strategy.

Explain the significant trade-offs briefly, choose a practical approach, and proceed with reversible development.

Identify features that need internet access. Keep privileged API credentials out of the distributed application.

A browser-based client viewer may be useful later, but the designer’s primary application should be downloadable.

## Second priority: improve the interactive room’s appearance

The everyday room view should look substantially more convincing while remaining responsive as the designer moves furniture, changes finishes, or rotates the camera.

Focus on:

- Accurate furniture shapes and dimensions.
- Fabric texture, wood grain, and distinct metal and glass surfaces.
- Convincing lighting, shadows, and reflections.
- Correct material and color handling.
- Useful camera controls and clear image exports.
- Performance on a stated reference computer.

I will provide visual reference images later. Until then, use a clean, neutral presentation and keep aesthetic decisions easy to revise.

When references arrive, identify what they establish about the interface, furniture detail, materials, lighting, and composition. Separate visual inspiration from actual retail product specifications.

Use your coding and visual-analysis capabilities to build, render, inspect, and improve the results. Do not assume a language model itself replaces a rendering engine or guarantees product accuracy.

## Rendering decision we have already made

**Improve the existing interactive renderer first. Blender is optional.**

Do not require Blender installation, cloud rendering, or a slow final-render pipeline to complete the first milestone.

Initially:

- Keep room editing interactive.
- Support quick previews and image exports from the room scene.
- Save exported images so they can be reopened immediately.

Later, benchmark an optional “Create final image” feature using Blender or another suitable renderer. Compare the same room for quality, elapsed time, hardware needs, and operating cost.

Any high-quality render should run as a separate job. Moving a chair must not trigger an expensive offline render.

Report measured results instead of inventing rendering-time or cost estimates.

## Correct the furniture asset pipeline

Previous inspection found the following; verify them:

- The built-in catalog includes generic entries, estimated prices, and retailer search links.
- The Meshy integration requests models with `should_texture: false`.
- The custom GLB converter removes textures and merges material groups into a single tintable surface.
- Product-photo color averaging provides only an approximation.

Those choices need reconsideration for faithful retail products.

Create a material-preserving import path, evaluating standard glTF/GLB loading. Preserve textures, texture mapping, separate materials, surface properties, scale, and orientation.

Do not automatically recolor real products to match a room palette. Selecting a different purchasable finish should select the corresponding real product variant.

Keep approximate models and conceptual recoloring clearly labeled.

## Real products and catalog expansion

Build a structure that separates:

1. Searchable product information.
2. Products with permitted, verified 3D assets ready for placement.

Track each product’s brand, identifiers, exact variant, dimensions and units, source, photographs, available material information, associated model, verification status, usage rights, and update date.

Keep unknown information unknown. Do not invent prices, availability, dimensions, or permissions.

Prefer authorized feeds, retailer APIs, manufacturer partnerships, and appropriately licensed models. Product-feed access does not automatically grant permission to redistribute models or send photographs to an AI service.

Do not bypass retailer access controls or assume publicly downloadable assets can be included in Nested’s commercial catalog.

Use clearly labeled, permitted demonstration assets while partnerships are pending. Keep private designer uploads separate from the shared catalog.

Start with a small collection. Do not make access to thousands of products a prerequisite for a working application.

## Prove quality with a small test room

Use representative furniture and materials: an upholstered chair or sofa, wooden table, metal lamp, patterned rug, and glass object.

Check dimensions, proportions, texture scale, separate finishes, appearance from multiple angles, and performance.

Preserve a detailed source asset and an optimized interactive version where useful.

AI-generated models remain approximate until reviewed. Matching overall width, depth, and height does not verify all product details.

The first visual milestone is one convincing furnished room that can be edited, saved, reopened, and exported.

## Development setup and continuity

Check which repository access, tools, and runtime capabilities are actually available.

Use GitHub if a repository is connected. Otherwise, work safely from the supplied files and explain what is needed to establish version control.

Maintain:

- A concise `AGENTS.md` containing essential rules and verified commands.
- A product brief with goals and milestones.
- A references folder.
- A short progress record with completed work, limitations, and next steps.

Consider two focused custom skills once the workflows are established:

- Asset intake: provenance, permissions, dimensions, materials, and preview generation.
- Visual review: repeatable room screenshots, comparison, and defect checks.

Avoid unnecessary plugins and overlapping instructions. Use tools because they solve a concrete problem.

## Milestones

1. Audit and preserve the existing project.
2. Launch the editor as a desktop application with reliable local save/open behavior.
3. Preserve full furniture materials and improve the interactive room’s appearance.
4. Export useful room images and compare design alternatives.
5. Pilot one authorized catalog source.
6. Add client sharing and feedback.
7. Evaluate optional high-quality rendering, subscriptions, and broader release.

## How to work with me

Use plain language. Explain what changed, why it matters, and how you verified it.

Continue through authorized, reversible work without repeatedly asking permission. Ask when missing information materially affects an important decision, and continue independent work where possible.

Use targeted tests for meaningful risks such as project data loss, unit conversion, model loading, and desktop packaging. Inspect actual visual output as part of rendering work.

If your environment cannot test the Windows application or installer, state exactly what remains unverified. Do not equate a browser preview with a tested desktop build.

Start now by auditing the project, recommending the desktop architecture, recording a short implementation plan, and beginning the first milestone.

Our immediate goal is a working desktop foundation followed by a convincing, responsive room view. Keep the work focused on delivering that experience.