# Craft in Motion

An interactive web experience exploring the connection between **human movement and digital animation**.

The project uses **ml5.js** for browser-based machine learning and **GSAP** for motion and animation, creating an interface that reacts to the user's movement in real time.

## About

**Craft in Motion** is an experimental interaction project focused on using the body as an input.

Instead of interacting only through traditional controls such as buttons, scrolling, or a mouse, the experience detects physical movement through the camera and translates it into animated responses on screen.

The project explores how motion tracking, animation, and visual design can work together to create a more playful and immersive web experience.

## Technologies

- **JavaScript**
- **ml5.js** — machine learning and movement detection
- **GSAP** — animations and transitions
- **HTML / CSS**
- Browser camera APIs

## Project Structure

```text
craft-in-motion/
├── app/            # Main interactive experience
├── experiments/    # Motion tracking and interaction experiments
├── .vscode/        # Editor configuration
└── README.md
```

The `experiments` directory contains smaller tests created while exploring different motion-tracking and animation ideas before integrating them into the main application.

## How It Works

The experience uses the user's webcam to detect movement or body position.

The detected motion is then translated into values that can influence elements of the interface, such as:

- position
- scale
- rotation
- transitions
- animated sequences

GSAP is used to make these reactions smoother and more expressive.

## Running the Project

Clone the repository:

```bash
git clone https://github.com/gagatkaa/craft-in-motion.git
cd craft-in-motion
```

Open the project in your preferred development environment and run the application from the `app` directory using the setup defined there.

> Camera permission is required for the interactive motion features.

## Experiments

A large part of the project was developed through experimentation.

The `experiments/` directory contains prototypes used to test:

- body and movement tracking
- camera interaction
- mapping movement to screen coordinates
- GSAP animation behaviour
- different interaction concepts

These experiments helped define the interaction used in the final experience.

## Goal

The goal of **Craft in Motion** is to explore how digital interfaces can become more physical and expressive by responding directly to human movement.

Rather than treating animation as decoration, motion becomes part of the interaction itself.

## Author

Created by [gagatkaa](https://github.com/gagatkaa).
