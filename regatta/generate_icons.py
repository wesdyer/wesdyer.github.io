from PIL import Image, ImageDraw

def create_map_icon(filename):
    size = (64, 64)
    img = Image.new('RGBA', size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Map paper background
    paper_color = (240, 240, 240, 255)
    outline_color = (100, 116, 139, 255) # Slate-500

    # Draw a folded map shape
    # Points for a trifold map
    points = [
        (10, 10), (22, 15), (22, 54), (10, 49), # Left panel
        (22, 15), (42, 10), (42, 49), (22, 54), # Middle panel
        (42, 10), (54, 15), (54, 54), (42, 49)  # Right panel
    ]

    # Left
    draw.polygon([(10, 10), (22, 15), (22, 54), (10, 49)], fill=paper_color, outline=outline_color)
    # Middle
    draw.polygon([(22, 15), (42, 10), (42, 49), (22, 54)], fill=(255, 255, 255, 255), outline=outline_color)
    # Right
    draw.polygon([(42, 10), (54, 15), (54, 54), (42, 49)], fill=paper_color, outline=outline_color)

    # Draw course path (red line)
    path_color = (239, 68, 68, 255) # Red-500
    path_points = [(16, 40), (32, 25), (48, 45)]
    draw.line(path_points, fill=path_color, width=3)

    # Marks (circles)
    mark_color = (234, 179, 8, 255) # Yellow-500
    for p in path_points:
        draw.ellipse([p[0]-3, p[1]-3, p[0]+3, p[1]+3], fill=mark_color, outline=(0,0,0,100))

    img.save(filename)
    print(f"Generated {filename}")

if __name__ == "__main__":
    create_map_icon("regatta/assets/images/course-icon.png")
