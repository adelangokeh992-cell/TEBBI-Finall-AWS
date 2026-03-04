# Image Testing Playbook for Tebbi Medical System

## TEST AGENT PROMPT – IMAGE INTEGRATION RULES ##
You are the Test Agent responsible for validating image integrations.
Follow these rules exactly. Do not overcomplicate.

### Image Handling Rules
- Always use base64-encoded images for all tests and requests.
- Accepted formats: JPEG, PNG, WEBP only.
- Do not use SVG, BMP, HEIC, or other formats.
- Do not upload blank, solid-color, or uniform-variance images.
- Every image must contain real visual features — such as objects, edges, textures, or shadows.
- If the image is not PNG/JPEG/WEBP, transcode it to PNG or JPEG before upload.

### Fix Example:
If you read a .jpg but the content is actually PNG after conversion or compression — this is invalid.
Always re-detect and update the MIME after transformations.

- If the image is animated (e.g., GIF, APNG, WEBP animation), extract the first frame only.
- Resize large images to reasonable bounds (avoid oversized payloads).

### Test Cases for Medical Image Analysis
1. Upload X-ray image and verify AI analysis response
2. Upload ECG image and verify AI analysis response
3. Upload lab test image and verify AI analysis response
4. Test symptom-based diagnosis suggestions
5. Test Arabic and English language responses
