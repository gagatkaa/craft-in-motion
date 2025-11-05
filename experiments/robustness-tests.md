# Robustness Tests - ML5 PoseNet Craft in Motion Experiment

**Author:** Agata Tomaszewska  
**Course:** Creative Code 3  
**Project:** PoseNet Live Tempo Tracker  
**Date:** November 2025

---

## 1. Purpose

The goal of these robustness tests is to evaluate how stable and reliable my ML5 PoseNet–based “Tempo Tracker” is under different real-life conditions.  
Since PoseNet depends on the webcam feed and lighting quality, I wanted to ensure the system performs correctly when users have different setups (e.g., weaker camera, low light, or limited body visibility).

The test also checks if the safety and low-light warnings appear correctly and if the model can recover gracefully from poor input.

---

## 2. Method

I used my own ML5 PoseNet setup from the project _PoseNet Live Tempo Tracker_, which measures the tempo of the selected wrist and checks the elbow angle to evaluate form.  
All tests were performed in a browser using a laptop webcam and a Iriun Webcam external camera (from an Iphone).

During each test, I observed:

- PoseNet keypoint stability (wrists, elbows, shoulders)
- Tempo responsiveness (BPM display)
- Safety and low-light banners
- General user experience and visual feedback

---

## 3. Test Scenarios

| Scenario                           | Setup                                                          | Expected Result                                               | Actual Result                                                                           | Pass/Fail  |
| ---------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ---------- |
| **Bright light, light background** | Top half of body visible, bright room light, light wall behind | Model tracks all keypoints, smooth tempo, no warnings         | Tracking was perfect, tempo was measured, banners off                                   | ✅         |
| **Low light (warm ambience)**      | Dim warm desk lamp only / PC monitor light screen              | Low-light banner might appear but tracking still works        | Banner appeared briefly at start, then tracking stable                                  | ✅         |
| **Backlight / strong shadows**     | Window behind subject                                          | Low-light or face loss warning appears; app should guide user | Tracking degraded, banner visible, tempo slowed but recovered                           | ⚠️ Partial |
| **Hand covers face**               | Shaker in front of face                                        | Safety banner should appear and hold until hand moves away    | Banner triggered correctly and stayed for ~1 s hold time                                | ✅         |
| **Elbow outside OK range**         | Arm raised too high                                            | Arc red, “Adjust” message shown                               | Responded correctly with clear visual feedback                                          | ✅         |
| **Camera low FPS**                 | Virtual webcam limited to 15 fps                               | Tempo should still update smoothly, maybe with delay          | Small lag but still functional; no freeze                                               | ✅         |
| **Framing off-center**             | User stands far left or right so one arm leaves the frame      | App should warn to stand back/centered                        | When one wrist disappears the "Move back" banner shows until both wrists are visible.   | ✅ Pass    |
| **Arms below camera**              | Torso visible but wrists below the video area                  | App should prompt to lower camera or step back                | Missing-wrist detector fires and holds. Added note in Observations about camera height. | ✅ Pass    |

---

## 4. Observations

- The experiment works best with **even light** and a **light background**.
- **Top-half body visibility** is essential for PoseNet to detect joints accurately.
- **Low-FPS** or poor-quality cameras cause tempo lag but not full failure.
- The **safety warning** functions reliably when the hand crosses the face area.
- **Angle feedback** (green/red arc) provides good clarity about correct form.
- The system struggles most when the **face or arms leave the frame**.
- The new missing-wrist detector prevents silent failures. When hands are not visible, a "Move back" banner appears with a short hold to avoid flicker.

---

## 5. Improvements

Based on the robustness results, I could improve the system by:

- Implementing **automatic light calibration** or brightness check before starting.
- Smoothing **tempo detection** to better handle low-FPS input.
- Logging **average FPS** and **keypoint accuracy** to quantify model stability.
- Using a short **hold delay (≈500 ms)** to avoid flickering warnings.

---

## 6. Conclusion

The current setup of the ML5 PoseNet “Tempo Tracker” is **robust under normal lighting and framing conditions**, and it **handles safety and low-light cases**.  
The main limitations appear in low-quality cameras or when the user moves too close to the lens.  
Overall, the system demonstrates strong robustness by combining detection accuracy with clear user guidance whenever visibility, lighting, or framing problems occur.

---
