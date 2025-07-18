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

/**
 * Resolve line intersections by changing origin points of intersecting lines
 * @param {Array} lines - Array of line objects with from and to points
 * @param {string} lineType - Type of lines for logging
 * @returns {Object} Object containing resolved lines and alternative lines
 */
export const resolveIntersections = (lines, lineType = 'lines') => {
  const intersections = findAndLogIntersections(lines, lineType);

  if (intersections.length === 0) {
    return {
      resolvedLines: lines,
      alternativeLines: []
    };
  }

  const resolvedLines = [...lines];
  const alternativeLines = [];
  const processedLineIndices = new Set();

  console.log(`🔧 Resolving ${intersections.length} ${lineType} intersections...`);

  intersections.forEach((intersection, index) => {
    const { line1Index, line2Index, point } = intersection;

    // Only process each line once (prioritize first intersection found)
    if (processedLineIndices.has(line1Index) && processedLineIndices.has(line2Index)) {
      return;
    }

    // Choose which line to modify (prefer the second line in the pair)
    const lineIndexToModify = processedLineIndices.has(line1Index) ? line2Index :
                             processedLineIndices.has(line2Index) ? line1Index : line2Index;

    const originalLine = lines[lineIndexToModify];
    // Create alternative line with new destination point (not origin)
    const newDestination = generateAlternativeDestination(originalLine, point, lines);
    const alternativeLine = {
      from: originalLine.from,  // Keep the same starting point (POI marker)
      to: newDestination,       // Change where it connects to the label
      originalIndex: lineIndexToModify,
      isAlternative: true
    };

    // Update the resolved line to remove it (will be replaced by alternative)
    resolvedLines[lineIndexToModify] = null;
    alternativeLines.push(alternativeLine);
    processedLineIndices.add(lineIndexToModify);

    console.log(`  ✅ Resolved intersection ${index + 1}: Line ${lineIndexToModify} destination moved to (${newDestination.x.toFixed(2)}, ${newDestination.y.toFixed(2)})`);
  });

  // Filter out null entries (removed lines)
  const finalResolvedLines = resolvedLines.filter(line => line !== null);

  console.log(`🎯 Resolution complete: ${finalResolvedLines.length} original lines + ${alternativeLines.length} alternative lines`);

  return {
    resolvedLines: finalResolvedLines,
    alternativeLines
  };
};

/**
 * Generate an alternative destination point that avoids intersections
 * @param {Object} originalLine - Original line object
 * @param {Object} intersectionPoint - Point where intersection occurs
 * @param {Array} allLines - All lines to avoid intersecting with
 * @returns {Object} New destination point {x, y}
 */
const generateAlternativeDestination = (originalLine, intersectionPoint, allLines) => {
  const { from, to } = originalLine;

  // Strategy 1: Move destination perpendicular to the line direction
  const lineVector = { x: to.x - from.x, y: to.y - from.y };
  const lineLength = Math.sqrt(lineVector.x * lineVector.x + lineVector.y * lineVector.y);

  if (lineLength === 0) {
    // Fallback for zero-length lines
    return { x: from.x + 20, y: from.y + 20 };
  }

  // Normalize line vector
  const normalizedVector = { x: lineVector.x / lineLength, y: lineVector.y / lineLength };

  // Create perpendicular vector (rotate 90 degrees)
  const perpVector = { x: -normalizedVector.y, y: normalizedVector.x };

  // Try different offset distances
  const offsetDistances = [30, 50, 80, 100];

  for (const distance of offsetDistances) {
    // Try both sides of the perpendicular
    const candidates = [
      {
        x: to.x + perpVector.x * distance,
        y: to.y + perpVector.y * distance
      },
      {
        x: to.x - perpVector.x * distance,
        y: to.y - perpVector.y * distance
      }
    ];

    for (const candidate of candidates) {
      const testLine = { from, to: candidate };

      // Check if this new line intersects with any existing lines
      const hasIntersection = allLines.some(existingLine => {
        if (existingLine === originalLine) return false;
        return getLineIntersection(testLine, existingLine) !== null;
      });

      if (!hasIntersection) {
        return candidate;
      }
    }
  }

  // Fallback: use a simple offset if no good position found
  return {
    x: to.x + 40,
    y: to.y + 40
  };
};

/**
 * Find and resolve all intersections, returning drawable line data
 * @param {Array} lines - Array of line objects with from and to points
 * @param {string} lineType - Type of lines for logging
 * @returns {Object} Object with original and alternative line arrays for drawing
 */
export const findAndResolveIntersections = (lines, lineType = 'lines') => {
  const result = resolveIntersections(lines, lineType);

  return {
    originalLines: result.resolvedLines,
    alternativeLines: result.alternativeLines,
    hasIntersections: result.alternativeLines.length > 0
  };
};
