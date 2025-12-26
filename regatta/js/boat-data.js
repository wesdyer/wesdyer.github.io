
const BOAT_CLASSES = {
    cruiser: {
        id: 'cruiser',
        displayName: 'Cruiser',
        description: "Heavy, stable, and forgiving. Best for learning the ropes.",
        visual: {
            hullScale: 1.0,
            hullWidthScale: 1.2, // Beamy
            deckColor: '#e2e8f0',
            bowsprit: false,
            sailScale: 0.9, // Smaller rig
            freeboardScale: 1.1
        },
        dynamics: {
            turnSpeed: 0.005, // Heavy (0.008 -> 0.005)
            turnPenalty: 0.998,
            accelFactor: 0.3, // Slow (0.5 -> 0.3)
            inertia: 0.9995, // High inertia (0.999 -> 0.9995)
            heelResponse: 0.5,
            planing: false,
            surfing: false,
            leeway: 0.05
        },
        polars: {
            angles: [0, 30, 40, 50, 60, 90, 110, 135, 150, 180],
            speeds: {
                6: {
                    spinnaker:    [0.0, 0.0, 0.5, 1.5, 3.0, 4.5, 5.0, 5.2, 4.8, 4.0],
                    nonSpinnaker: [0.0, 0.0, 3.2, 3.8, 4.2, 4.5, 4.2, 3.8, 3.2, 2.8]
                },
                10: {
                    spinnaker:    [0.0, 0.0, 0.8, 2.5, 4.5, 6.0, 6.5, 6.2, 5.8, 5.0],
                    nonSpinnaker: [0.0, 0.0, 4.5, 5.2, 5.8, 6.0, 5.5, 4.8, 4.2, 3.8]
                },
                14: {
                    spinnaker:    [0.0, 0.0, 1.0, 3.0, 5.0, 6.8, 7.2, 6.8, 6.4, 5.8],
                    nonSpinnaker: [0.0, 0.0, 5.2, 5.8, 6.2, 6.5, 6.0, 5.2, 4.8, 4.2]
                },
                20: {
                    spinnaker:    [0.0, 0.0, 1.2, 3.5, 5.5, 7.2, 7.5, 7.2, 6.8, 6.2],
                    nonSpinnaker: [0.0, 0.0, 5.5, 6.2, 6.5, 6.8, 6.2, 5.5, 5.0, 4.5]
                }
            }
        }
    },
    performance: {
        id: 'performance',
        displayName: 'Performance',
        description: "Balanced racer-cruiser. Fast, smooth, and versatile.",
        visual: {
            hullScale: 1.05,
            hullWidthScale: 0.95, // Sleek
            deckColor: '#cbd5e1',
            bowsprit: true,
            bowspritLength: 6, // Short
            sailScale: 1.0,
            freeboardScale: 1.0
        },
        dynamics: {
            turnSpeed: 0.011, // Standard
            turnPenalty: 0.999,
            accelFactor: 0.8,
            inertia: 0.998,
            heelResponse: 0.8,
            planing: false,
            surfing: true,
            leeway: 0.02
        },
        polars: {
            angles: [0, 30, 38, 45, 52, 60, 75, 90, 110, 120, 135, 150, 180],
            speeds: {
                6: {
                    spinnaker: [0.0, 0.0, 0.5, 1.0, 1.5, 2.0, 3.0, 5.46, 5.5, 5.48, 5.25, 4.72, 4.01],
                    nonSpinnaker: [0.0, 0.0, 4.7, 4.93, 5.18, 5.29, 5.36, 5.46, 4.94, 4.65, 4.08, 3.51, 3.01]
                },
                8: {
                    spinnaker: [0.0, 0.0, 0.6, 1.2, 1.8, 2.4, 3.5, 6.79, 6.87, 6.85, 6.58, 5.94, 5.06],
                    nonSpinnaker: [0.0, 0.0, 5.8, 6.09, 6.41, 6.55, 6.65, 6.79, 6.17, 5.82, 5.12, 4.42, 3.8]
                },
                10: {
                    spinnaker: [0.0, 0.0, 0.7, 1.4, 2.1, 2.8, 4.0, 7.89, 8.01, 8.01, 7.72, 6.99, 6.0],
                    nonSpinnaker: [0.0, 0.0, 6.66, 7.0, 7.38, 7.56, 7.7, 7.89, 7.2, 6.8, 6.0, 5.2, 4.5]
                },
                12: {
                    spinnaker: [0.0, 0.0, 0.8, 1.6, 2.4, 3.2, 4.5, 8.6, 8.74, 8.75, 8.44, 7.65, 6.58],
                    nonSpinnaker: [0.0, 0.0, 7.23, 7.6, 8.02, 8.22, 8.38, 8.6, 7.85, 7.42, 6.56, 5.69, 4.93]
                },
                14: {
                    spinnaker: [0.0, 0.0, 0.9, 1.8, 2.7, 3.6, 5.0, 9.01, 9.18, 9.2, 8.89, 8.08, 6.98],
                    nonSpinnaker: [0.0, 0.0, 7.52, 7.91, 8.36, 8.57, 8.76, 9.01, 8.25, 7.81, 6.91, 6.01, 5.23]
                },
                16: {
                    spinnaker: [0.0, 0.0, 1.0, 2.0, 3.0, 4.0, 5.5, 9.42, 9.66, 9.7, 9.42, 8.59, 7.47],
                    nonSpinnaker: [0.0, 0.0, 7.76, 8.18, 8.66, 8.9, 9.13, 9.42, 8.68, 8.24, 7.32, 6.39, 5.61]
                },
                20: {
                    spinnaker: [0.0, 0.0, 1.2, 2.4, 3.6, 4.8, 6.5, 10.43, 10.87, 11.01, 10.81, 9.98, 8.88],
                    nonSpinnaker: [0.0, 0.0, 8.2, 8.7, 9.26, 9.6, 9.98, 10.43, 9.77, 9.35, 8.4, 7.42, 6.66]
                }
            }
        }
    },
    sport: {
        id: 'sport',
        displayName: 'Sport',
        description: "Lightweight, high-performance sportboat. Planes downwind.",
        visual: {
            hullScale: 0.85,
            hullWidthScale: 1.1,
            deckColor: '#f8fafc',
            bowsprit: true,
            bowspritLength: 18, // Long
            sailScale: 1.1,
            freeboardScale: 0.8
        },
        dynamics: {
            turnSpeed: 0.022, // Twitchy (0.015 -> 0.022)
            turnPenalty: 0.995,
            accelFactor: 2.5, // Rocket (1.5 -> 2.5)
            inertia: 0.985, // Stops fast (0.990 -> 0.985)
            heelResponse: 3.0,
            planing: true,
            surfing: false,
            leeway: 0.03
        },
        polars: {
            angles: [0, 30, 40, 45, 60, 90, 110, 130, 145, 180],
            speeds: {
                6: {
                    spinnaker:    [0.0, 0.0, 0.5, 1.0, 3.0, 5.0, 5.2, 5.0, 4.5, 3.5],
                    nonSpinnaker: [0.0, 0.0, 3.8, 4.2, 4.8, 4.8, 4.5, 4.0, 3.2, 2.5]
                },
                10: {
                    spinnaker:    [0.0, 0.0, 1.0, 2.0, 4.5, 6.5, 7.0, 6.8, 6.0, 5.0],
                    nonSpinnaker: [0.0, 0.0, 5.0, 5.5, 6.0, 6.2, 5.8, 5.0, 4.2, 3.5]
                },
                14: {
                    spinnaker:    [0.0, 0.0, 1.5, 3.5, 6.0, 9.0, 10.0, 11.0, 9.0, 7.0],
                    nonSpinnaker: [0.0, 0.0, 5.8, 6.0, 6.5, 6.8, 6.2, 5.5, 4.8, 4.0]
                },
                20: {
                    spinnaker:    [0.0, 0.0, 2.0, 4.0, 7.0, 11.0, 13.0, 15.0, 12.0, 9.0],
                    nonSpinnaker: [0.0, 0.0, 6.0, 6.2, 6.8, 7.2, 6.8, 6.0, 5.2, 4.5]
                }
            }
        }
    }
};
