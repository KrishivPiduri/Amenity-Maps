/**
 * Calculate intersection point of two lines
 * @param {Object} line1 - First line with from and to points
 * @param {Object} line2 - Second line with from and to points
 * @returns {Object|null} Intersection point {x, y} or null if no intersection
 */
export const getLineIntersection = (line1, line2) => {
  const x1 = line1.from.x, y1 = line1.from.y;
  const x2 = line1.to.x, y2 = line1.to.y;
  const x3 = line2.from.x, y3 = line2.from.y;
  const x4 = line2.to.x, y4 = line2.to.y;

  const denominator = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);

  // Lines are parallel
  if (Math.abs(denominator) < 1e-10) {
    return null;
  }

  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denominator;
  const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denominator;

  // Check if intersection is within both line segments
  if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
    return {
      x: x1 + t * (x2 - x1),
      y: y1 + t * (y2 - y1)
    };
  }

  return null;
};

/**
 * Find all intersections between lines and log them
 * @param {Array} lines - Array of line objects with from and to points
 * @param {string} lineType - Type of lines for logging
 */
export const findAndLogIntersections = (lines, lineType = 'lines') => {
  const intersections = [];

  for (let i = 0; i < lines.length; i++) {
    for (let j = i + 1; j < lines.length; j++) {
      const intersection = getLineIntersection(lines[i], lines[j]);
      if (intersection) {
        intersections.push({
          point: intersection,
          line1Index: i,
          line2Index: j,
          line1: lines[i],
          line2: lines[j]
        });
      }
    }
  }

  if (intersections.length > 0) {
    console.log(`🔍 Found ${intersections.length} ${lineType} intersections:`);
    intersections.forEach((intersection, index) => {
      console.log(`  ${index + 1}. Lines ${intersection.line1Index} and ${intersection.line2Index} intersect at:`, {
        x: intersection.point.x.toFixed(2),
        y: intersection.point.y.toFixed(2)
      });
      console.log(`    Line ${intersection.line1Index}:`, {
        from: { x: intersection.line1.from.x.toFixed(2), y: intersection.line1.from.y.toFixed(2) },
        to: { x: intersection.line1.to.x.toFixed(2), y: intersection.line1.to.y.toFixed(2) }
      });
      console.log(`    Line ${intersection.line2Index}:`, {
        from: { x: intersection.line2.from.x.toFixed(2), y: intersection.line2.from.y.toFixed(2) },
        to: { x: intersection.line2.to.x.toFixed(2), y: intersection.line2.to.y.toFixed(2) }
      });
    });
  } else {
    console.log(`ℹ️ No ${lineType} intersections found`);
  }

  return intersections;
};
