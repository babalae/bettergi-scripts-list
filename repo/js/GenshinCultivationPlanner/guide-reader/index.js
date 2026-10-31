import { collectArtifactRecommendationSample } from './artifact-sample.js';

// Proven Training Guide recognition migrated from bettergi-growth-planner.
// This module only reads and validates guide state. It does not plan or execute game tasks.

let GUIDE_IDENTITIES;

function normalizeKnownGuideCharacterName(value) {
  // CN guide OCR can read this name with the traditional first glyph. Keep
  // the OCR evidence unchanged and normalize only at identity/comparison boundaries.
  return value === "奧黛塔" ? "奥黛塔" : value;
}

function normalizeGuideCollectionCharacterNames(collection) {
  return {
    ...collection,
    home: collection && collection.home ? {
      ...collection.home,
      characters: Array.isArray(collection.home.characters) ? collection.home.characters.map(function (character) {
        return { ...character, name: normalizeKnownGuideCharacterName(character.name) };
      }) : collection.home.characters
    } : collection && collection.home,
    characters: collection && Array.isArray(collection.characters) ? collection.characters.map(function (character) {
      return { ...character, name: normalizeKnownGuideCharacterName(character.name) };
    }) : collection && collection.characters
  };
}

function readGuideJson(path) {
  return JSON.parse(file.ReadTextSync(path));
}
// ---- Migrated from bettergi-growth-planner/src/guide-reader.js ----
function parseGuideHome(snapshot) {
  function fail(message) {
    return { ok: false, error: message };
  }

  if (!snapshot || snapshot.ok !== true || !snapshot.screen || !Array.isArray(snapshot.regions)) {
    return fail("Invalid OCR snapshot");
  }

  const width = Number(snapshot.screen.width);
  const height = Number(snapshot.screen.height);
  if (!(width > 0 && height > 0) || Math.abs(width / height - 16 / 9) > 0.02) {
    return fail("Unsupported screen geometry");
  }

  const sx = width / 1920;
  const sy = height / 1080;
  const regions = snapshot.regions.map(function (region) {
    return {
      text: String(region.text || "").trim(),
      x: Number(region.x),
      y: Number(region.y),
      width: Number(region.width),
      height: Number(region.height)
    };
  });
  if (regions.some(function (region) {
    return !region.text || !Number.isFinite(region.x) || !Number.isFinite(region.y) ||
      !Number.isFinite(region.width) || !Number.isFinite(region.height) ||
      region.x < 0 || region.y < 0 || region.width <= 0 || region.height <= 0;
  })) return fail("Invalid OCR region");
  const title = regions.find(function (region) {
    return region.text === "提升指南" && region.y < 100 * sy;
  });
  if (!title) return fail("Not on the 提升指南 home screen");

  const headerMatches = regions.map(function (region) {
    const match = region.text.match(/^培养计划角色列表[（(](\d+)\/(\d+)[）)]$/);
    return match ? { region: region, count: Number(match[1]), capacity: Number(match[2]) } : null;
  }).filter(Boolean);
  if (headerMatches.length !== 1) return fail("Missing or ambiguous plan header");

  const header = headerMatches[0];
  if (header.count > header.capacity) return fail("Plan count exceeds capacity");
  const partyHeader = regions.find(function (region) {
    return /^队伍内角色实力/.test(region.text) && region.y > header.region.y;
  });
  const sectionBottom = partyHeader ? partyHeader.y : height;
  const badges = regions.filter(function (region) {
    return /^(培养中|已完成)$/.test(region.text) && region.y > header.region.y && region.y < sectionBottom;
  });

  if (header.count === 0) {
    return badges.length === 0
      ? { ok: true, count: 0, capacity: header.capacity, incomplete: false, characters: [] }
      : fail("Plan header count does not match visible badges");
  }
  if (badges.length === 0 || badges.length > header.count) {
    return fail("Plan header count does not match visible badges");
  }
  if (partyHeader && badges.length !== header.count) {
    return fail("Plan header count does not match visible badges");
  }

  const characters = [];
  for (const badge of badges) {
    const names = regions.filter(function (region) {
      const centerDelta = Math.abs((region.y + region.height / 2) - (badge.y + badge.height / 2));
      return region.x >= 700 * sx && region.x < 1200 * sx && centerDelta <= 25 * sy;
    });
    const levels = regions.filter(function (region) {
      return /^Lv\.\d+$/i.test(region.text) && region.x >= 620 * sx && region.x < 850 * sx &&
        region.y > badge.y + 55 * sy && region.y < badge.y + 135 * sy;
    });
    const upgrades = regions.filter(function (region) {
      return region.text === "提升" && region.x > 1550 * sx &&
        region.y >= badge.y && region.y < badge.y + 90 * sy;
    });
    if (names.length !== 1 || levels.length !== 1 || upgrades.length !== 1) {
      return fail("Could not identify one complete enabled-character row");
    }

    characters.push({
      name: names[0].text,
      guideStatus: badge.text,
      level: Number(levels[0].text.slice(3)),
      upgradePoint: {
        x: upgrades[0].x + upgrades[0].width / 2,
        y: upgrades[0].y + upgrades[0].height / 2
      }
    });
  }

  const names = characters.map(function (character) { return character.name; });
  if (new Set(names).size !== names.length) return fail("Duplicate enabled-character names");
  return {
    ok: true,
    count: header.count,
    capacity: header.capacity,
    incomplete: characters.length < header.count,
    characters: characters.sort(function (a, b) { return a.upgradePoint.y - b.upgradePoint.y; })
  };
}

// ---- Migrated from bettergi-growth-planner/src/guide-details.js ----
function validSnapshot(snapshot) {
  return snapshot && snapshot.ok === true && snapshot.screen &&
    snapshot.screen.width > 0 && snapshot.screen.height > 0 && Array.isArray(snapshot.regions) &&
    snapshot.regions.every(function (region) {
      return region && Number.isFinite(Number(region.x)) && Number.isFinite(Number(region.y)) &&
        Number.isFinite(Number(region.width)) && Number.isFinite(Number(region.height)) &&
        Number(region.width) > 0 && Number(region.height) > 0;
    });
}

function pageRegions(page) {
  if (!page || !Array.isArray(page.snapshots)) throw new Error("Invalid guide page");
  const output = [];
  for (const snapshot of page.snapshots) {
    if (!validSnapshot(snapshot)) throw new Error("Invalid guide page snapshot");
    const sx = 1920 / snapshot.screen.width;
    const sy = 1080 / snapshot.screen.height;
    for (const region of snapshot.regions) {
      output.push({
        text: String(region.text || "").trim().replace(/^lv\.(\d+)$/i, "Lv.$1"),
        x: Number(region.x) * sx,
        y: Number(region.y) * sy,
        width: Number(region.width) * sx,
        height: Number(region.height) * sy,
        snapshot: snapshot.snapshot_id || null
      });
    }
  }
  return output;
}

function oneValue(values) {
  const known = values.filter(function (value) { return value !== null && value !== undefined; });
  return known.length && known.every(function (value) { return value === known[0]; }) ? known[0] : null;
}

function isUpgradeGoalLabel(text) {
  return text === "升级至" || /^需要角色突破到\s*\d+\s*阶$/.test(text);
}

function isGuideMaterialSource(text, tab) {
  return /^(?:精通秘境|炼武秘境)\s*[:：]/.test(text) || /^\d+\s*级以上.*掉落$/.test(text) ||
    (tab === "角色等级" && text === "冒险之证讨伐页签查看");
}

function parseLevelPage(page) {
  const regions = pageRegions(page);
  const homeLevel = Number(page && page.home_level);
  const noUpgradeEvidence = regions.filter(function (region) {
    return region.text === "角色等级方面暂无可提升事项，可查看其他提升事项";
  });
  const current = regions.map(function (region) {
    const match = region.x >= 620 && region.x < 900 && region.y > 300 && region.y < 500 &&
      region.text.match(/^等级\s*(\d+)$/);
    return match ? Number(match[1]) : null;
  });
  const targets = regions.filter(function (region) {
    return /^\d+$/.test(region.text) && region.x > 1500 && region.x < 1800 && region.y > 300 && region.y < 500;
  }).map(function (region) { return Number(region.text); });
  const currentLevel = oneValue(current);
  const targetLevel = oneValue(targets);
  const materialStatuses = regions.filter(region => region.x >= 620 && region.x < 1000 &&
    region.y > 350 && region.y < 450 && /^(可升级|材料不足)$/.test(region.text));
  const materialStatus = oneValue(materialStatuses.map(region => region.text));
  const statusConfirmed = materialStatus !== null && new Set(materialStatuses.filter(region =>
    region.text === materialStatus).map(region => region.snapshot).filter(Boolean)).size >= 2;
  if (noUpgradeEvidence.length > 0) {
    const validHomeLevel = Number.isSafeInteger(homeLevel) && homeLevel >= 1 && homeLevel <= 100;
    const confirmingSnapshots = new Set(noUpgradeEvidence.map(function (region) { return region.snapshot; }).filter(Boolean));
    return {
      incomplete: !!page.incomplete || confirmingSnapshots.size < 2 || !validHomeLevel ||
        current.some(value => value !== null) || targets.length > 0,
      current: validHomeLevel ? homeLevel : null,
      target: null,
      materialStatus: null,
      noUpgradeNeeded: true,
      noUpgradeEvidence: noUpgradeEvidence.map(function (region) { return region.snapshot; })
    };
  }
  const validCurrent = Number.isSafeInteger(currentLevel) && currentLevel >= 1 && currentLevel <= 100;
  const validTarget = Number.isSafeInteger(targetLevel) && targetLevel >= 1 && targetLevel <= 100;
  const confirmingSnapshots = new Set((page.snapshots || []).filter(function (snapshot) {
    const frame = pageRegions({ snapshots: [snapshot] });
    const frameCurrent = oneValue(frame.map(function (region) {
      const match = region.x >= 620 && region.x < 900 && region.y > 300 && region.y < 500 &&
        region.text.match(/^等级\s*(\d+)$/);
      return match ? Number(match[1]) : null;
    }));
    const frameTarget = oneValue(frame.filter(function (region) {
      return /^\d+$/.test(region.text) && region.x > 1500 && region.x < 1800 && region.y > 300 && region.y < 500;
    }).map(function (region) { return Number(region.text); }));
    return frameCurrent === currentLevel && frameTarget === targetLevel;
  }).map(function (snapshot) { return snapshot.snapshot_id; }).filter(Boolean));
  return {
    incomplete: !!page.incomplete || !validCurrent || !validTarget || confirmingSnapshots.size < 2 || !statusConfirmed,
    current: validCurrent ? currentLevel : null,
    target: validTarget ? targetLevel : null,
    materialStatus: materialStatus,
    noUpgradeNeeded: false
  };
}

function materialSourceRegions(regions, top, bottom) {
  return regions.filter(region => region.x >= 780 && region.x < 1500 &&
    region.y > Math.max(top, 330) && region.y < Math.min(bottom, 1020) &&
    (/^(?:精通秘境|炼武秘境)\s*[:：]/.test(region.text) || /^\d+\s*级以上.*掉落$/.test(region.text)));
}

function parseWeaponPage(page) {
  const observations = [];
  for (const [snapshotIndex, snapshot] of (page.snapshots || []).entries()) {
    const regions = pageRegions({ snapshots: [snapshot] });
    const heading = regions.find(function (region) { return region.text === "强化当前武器"; });
    const boundary = regions.find(function (region) { return region.text === "使用率较高的武器参考"; });
    if (!heading) continue;
    const cardBottom = Math.min(boundary ? boundary.y : heading.y + 165, heading.y + 165);
    const between = regions.filter(function (region) {
      return region.y > heading.y && region.y < cardBottom;
    });
    const name = between.filter(function (region) {
      return region.x >= 760 && region.x < 1200 && !/^Lv\./.test(region.text) &&
        !/^(已达|可升级|升级材料|材料不足)/.test(region.text);
    }).sort(function (a, b) { return a.y - b.y; })[0];
    const currentValues = between.map(function (region) {
      const match = region.x >= 620 && region.x < 780 && region.text.match(/^Lv\.(\d+)$/);
      return match ? Number(match[1]) : null;
    }).filter(function (value) { return value !== null; });
    const targetValues = between.map(function (region) {
      return region.x > 1500 && region.x < 1800 && /^\d+$/.test(region.text)
        ? Number(region.text) : null;
    }).filter(function (value) { return value !== null; });
    const level = oneValue(currentValues);
    const numericTarget = oneValue(targetValues);
    const reachedTarget = between.some(function (region) { return region.text === "已达可观水准"; });
    const target = numericTarget !== null ? numericTarget : (reachedTarget ? level : null);
    const conflictingFields = new Set(currentValues).size > 1 || new Set(targetValues).size > 1 ||
      (reachedTarget && numericTarget !== null && (level === null || numericTarget !== level));
    observations.push({
      name: name ? name.text : null,
      current: level,
      target: target,
      conflictingFields: conflictingFields,
      snapshot: snapshot.snapshot_id || null, snapshotIndex: snapshotIndex, y: heading.y
    });
  }
  const conflictingFields = observations.some(function (item) { return item.conflictingFields; });
  const name = oneValue(observations.map(function (item) { return item.name; }));
  const current = oneValue(observations.map(function (item) { return item.current; }));
  const target = oneValue(observations.map(function (item) { return item.target; }));
  const missingFields = [["name", name], ["current", current], ["target", target]]
    .filter(function (entry) { return entry[1] === null; })
    .map(function (entry) { return entry[0]; });
  const needsReread = [];
  const validLevels = Number.isSafeInteger(current) && current >= 1 && current <= 90 &&
    Number.isSafeInteger(target) && target >= 1 && target <= 90;
  const confirmingSnapshots = new Set(observations.filter(function (item) {
    return !item.conflictingFields && item.name === name && item.current === current && item.target === target &&
      typeof item.snapshot === "string" && item.snapshot;
  }).map(function (item) { return item.snapshot; }));
  if (missingFields.length > 0) needsReread.push({
    name: name,
    reason: "incomplete_weapon_fields",
    fields: missingFields,
    snapshots: observations.map(function (item) { return item.snapshot; })
  });
  if (!validLevels) needsReread.push({
    name: name, reason: "invalid_weapon_level_range",
    snapshots: observations.map(function (item) { return item.snapshot; })
  });
  if (confirmingSnapshots.size < 2) needsReread.push({
    name: name, reason: "weapon_fields_need_two_fresh_snapshots",
    snapshots: Array.from(confirmingSnapshots)
  });
  return {
    incomplete: !!page.incomplete || conflictingFields ||
      missingFields.length > 0 || !validLevels || confirmingSnapshots.size < 2,
    name: name,
    current: current,
    target: target,
    observations: observations,
    needsReread: needsReread
  };
}

function parseTalentPage(page) {
  const observations = [];
  for (const [snapshotIndex, snapshot] of (page.snapshots || []).entries()) {
    const regions = pageRegions({ snapshots: [snapshot] });
    const markers = regions.filter(function (region) {
      return isUpgradeGoalLabel(region.text) && region.x > 1500 && region.y >= 295 && region.y < 1040;
    }).sort((a, b) => a.y - b.y);
    for (const [index, marker] of markers.entries()) {
      const row = regions.filter(function (region) {
        return region.y >= marker.y && region.y < Math.min(marker.y + 105, 1040);
      });
      const names = row.filter(function (region) {
        return region.x >= 760 && region.x < 1200 &&
          !/^(已达到目标|升级材料不足|可升级|升级至|Lv\.)/.test(region.text);
      });
      const name = names.length === 1 ? names[0].text : null;
      const currentValues = row.map(function (region) {
        const match = region.x >= 620 && region.x < 780 && region.text.match(/^Lv\.(\d+)$/);
        return match ? Number(match[1]) : null;
      }).filter(value => value !== null);
      const targetValues = row.map(function (region) {
        return region.x + region.width / 2 >= 1605 && region.x + region.width / 2 <= 1675 &&
          /^\d+$/.test(region.text) ? Number(region.text) : null;
      }).filter(value => value !== null);
      const statusValues = row.filter(region => /^(已达到目标|升级材料不足|可升级)$/.test(region.text))
        .map(region => region.text);
      observations.push({
        name: name, nameCandidates: names.map(region => region.text),
        displayedCurrent: oneValue(currentValues), target: oneValue(targetValues),
        requiredAscensionStage: marker.text === "升级至" ? 0 :
          Number(marker.text.match(/^需要角色突破到\s*(\d+)\s*阶$/)[1]),
        goalStatus: oneValue(statusValues),
        conflictingFields: new Set(currentValues).size > 1 || new Set(targetValues).size > 1,
        fields: row,
        snapshot: snapshot.snapshot_id || null, snapshotIndex: snapshotIndex, y: marker.y,
        materialSources: materialSourceRegions(regions, marker.y + 105,
          markers[index + 1] ? markers[index + 1].y : 1040)
      });
    }
    // Keep unanchored numeric evidence, but never attach it to a guessed/truncated name.
    const orphanFields = regions.filter(region => region.y >= 295 && region.y < 1040 &&
      ((region.x + region.width / 2 >= 1605 && region.x + region.width / 2 <= 1675 && /^\d+$/.test(region.text)) ||
       (region.x >= 620 && region.x < 780 && /^Lv\.\d+$/.test(region.text))) &&
      !markers.some(marker => region.y >= marker.y && region.y < marker.y + 105));
    for (const field of orphanFields) observations.push({
      name: null,
      displayedCurrent: /^Lv\./.test(field.text) ? Number(field.text.slice(3)) : null,
      target: /^\d+$/.test(field.text) ? Number(field.text) : null,
      orphanFields: [field], snapshot: snapshot.snapshot_id || null, snapshotIndex: snapshotIndex,
      y: field.y, materialSources: []
    });
  }
  // Scroll edges stay in observations but are not additional talent cards.
  const cards = observations.filter(item => !item.orphanFields && item.y + 105 <= 1040);
  const unresolvedOrphans = observations.filter(function (item) { return item.orphanFields; }).filter(function (orphan) {
    const candidates = cards.filter(function (card) {
      if (card.snapshotIndex === orphan.snapshotIndex || card.name === null ||
          card.displayedCurrent === null || card.target === null || card.conflictingFields) return false;
      if (orphan.displayedCurrent !== null && card.displayedCurrent !== orphan.displayedCurrent) return false;
      if (orphan.target !== null && card.target !== orphan.target) return false;
      const shifts = [];
      for (const left of cards) {
        if (left.snapshotIndex !== orphan.snapshotIndex || left.name === null ||
            left.displayedCurrent === null || left.conflictingFields) continue;
        for (const right of cards) {
          if (right.snapshotIndex === card.snapshotIndex && right.name === left.name &&
            right.displayedCurrent === left.displayedCurrent &&
              (right.target === null || left.target === null || right.target === left.target) &&
              !right.conflictingFields) shifts.push(right.y - left.y);
        }
      }
      // Translate the numeric field using other fully identified cards. A number's
      // own Y is not the card heading Y; comparing those directly rejected genuine
      // top-edge fragments even when adjacent complete cards proved the scroll.
      if (!shifts.length || shifts.some(shift => Math.abs(shift - shifts[0]) > 12)) return false;
      return orphan.orphanFields.every(field => {
        const y = field.y + field.height / 2 + shifts[0];
        return y >= card.y && y < card.y + 105;
      });
    });
    return new Set(candidates.map(card => JSON.stringify([card.name, card.displayedCurrent, card.target]))).size !== 1;
  });
  const observationsByName = new Map();
  for (const item of cards) {
    if (item.name === null) continue;
    if (!observationsByName.has(item.name)) observationsByName.set(item.name, []);
    observationsByName.get(item.name).push(item);
  }
  function samePositionedMaterialSource(left, right) {
    return left.materialSources.some(function (leftSource) {
      return right.materialSources.some(function (rightSource) {
        return leftSource.text === rightSource.text &&
          Math.abs((leftSource.y - left.y) - (rightSource.y - right.y)) <= 12;
      });
    });
  }
  const canonicalNames = new Map();
  for (const [shortName, shortObservations] of observationsByName) {
    const longerNames = Array.from(observationsByName.keys()).filter(function (name) {
      return name !== shortName && name.startsWith(shortName);
    });
    if (longerNames.length !== 1) continue;
    const longName = longerNames[0];
    const longObservations = observationsByName.get(longName);
    const longSnapshots = new Set(longObservations.map(item => item.snapshot).filter(Boolean));
    if (longSnapshots.size < 2) continue;
    if (shortObservations.some(shortItem =>
        longObservations.some(longItem => longItem.snapshot === shortItem.snapshot))) continue;
    const allShortObservationsBridged = shortObservations.every(function (shortItem) {
      return shortItem.displayedCurrent !== null && shortItem.target !== null &&
        longObservations.some(function (longItem) {
          return longItem.displayedCurrent !== null && longItem.target !== null &&
            Math.abs(longItem.snapshotIndex - shortItem.snapshotIndex) === 1 &&
            Math.abs(longItem.y - shortItem.y) <= 180 &&
            longItem.displayedCurrent === shortItem.displayedCurrent &&
            longItem.target === shortItem.target && samePositionedMaterialSource(shortItem, longItem);
        });
    });
    if (allShortObservationsBridged) canonicalNames.set(shortName, longName);
  }
  const grouped = new Map();
  for (const item of cards) {
    const key = item.name === null ? item : (canonicalNames.get(item.name) || item.name);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(item);
  }
  const needsReread = [];
  if (unresolvedOrphans.length) needsReread.push({
    name: null, reason: "unresolved_orphan_talent_fields",
    snapshots: unresolvedOrphans.map(function (item) { return item.snapshot; })
  });
  const talents = Array.from(grouped, function (pair) {
    const talent = {
      name: typeof pair[0] === "string" ? pair[0] : null,
      displayedCurrent: oneValue(pair[1].map(function (item) { return item.displayedCurrent; })),
      target: oneValue(pair[1].map(function (item) { return item.target; })),
      requiredAscensionStage: oneValue(pair[1].map(item => item.requiredAscensionStage)),
      goalStatus: oneValue(pair[1].map(function (item) { return item.goalStatus; })),
      observations: pair[1]
    };
    const validLevels = Number.isSafeInteger(talent.displayedCurrent) && talent.displayedCurrent >= 1 &&
      talent.displayedCurrent <= 15 && Number.isSafeInteger(talent.target) &&
      talent.target >= 1 && talent.target <= 15;
    const confirmingSnapshots = new Set(pair[1].filter(function (item) {
      return !item.conflictingFields && item.displayedCurrent === talent.displayedCurrent &&
        item.target === talent.target && typeof item.snapshot === "string" && item.snapshot;
    }).map(function (item) { return item.snapshot; }));
    if (talent.name === null || talent.displayedCurrent === null || talent.target === null ||
        pair[1].some(item => item.conflictingFields)) needsReread.push({
      name: talent.name, reason: "incomplete_or_conflicting_talent",
      snapshots: pair[1].map(item => item.snapshot)
    });
    if (!validLevels) needsReread.push({
      name: talent.name, reason: "invalid_talent_level_range",
      snapshots: pair[1].map(function (item) { return item.snapshot; })
    });
    const statusConfirmed = new Set(pair[1].filter(item => item.goalStatus === talent.goalStatus &&
      item.displayedCurrent === talent.displayedCurrent && item.target === talent.target)
      .map(item => item.snapshot).filter(Boolean)).size >= 2;
    if (!Number.isSafeInteger(talent.requiredAscensionStage) || talent.requiredAscensionStage < 0 ||
        talent.requiredAscensionStage > 6 || new Set(pair[1].filter(item =>
          item.requiredAscensionStage === talent.requiredAscensionStage)
          .map(item => item.snapshot).filter(Boolean)).size < 2) {
      needsReread.push({ name: talent.name, reason: "talent_ascension_prerequisite_unconfirmed",
        snapshots: pair[1].map(item => item.snapshot) });
    }
    if (talent.goalStatus === null || !statusConfirmed || (validLevels &&
        (talent.goalStatus === "已达到目标") !== (talent.target <= talent.displayedCurrent))) {
      needsReread.push({ name: talent.name, reason: "talent_goal_status_missing_or_inconsistent",
        snapshots: pair[1].map(item => item.snapshot) });
    }
    if (confirmingSnapshots.size < 2) needsReread.push({
      name: talent.name, reason: "talent_fields_need_two_fresh_snapshots",
      snapshots: Array.from(confirmingSnapshots)
    });
    return talent;
  });
  const names = talents.map(talent => talent.name).filter(name => name !== null);
  for (const name of names) {
    const possibleNames = names.filter(other => other !== name && (other.startsWith(name) || name.startsWith(other)));
    if (possibleNames.length) needsReread.push({
      name: name, reason: "possible_truncated_name", possibleNames: possibleNames,
      snapshots: grouped.get(name).map(item => item.snapshot)
    });
  }
  return {
    incomplete: !!page.incomplete || needsReread.length > 0,
    talents: talents, observations: observations, needsReread: needsReread
  };
}

function serverGameDay(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error("Invalid date");
  const shifted = new Date(date.getTime() + 4 * 60 * 60 * 1000);
  return shifted.toISOString().slice(0, 10);
}

function parseCharacterProgress(character) {
  const pages = character && character.pages ? character.pages : {};
  function safely(parser, page, fallback) {
    try {
      return page ? parser(page) : fallback;
    } catch (error) {
      return Object.assign({}, fallback, { error: String(error.message || error) });
    }
  }
  return {
    name: character && character.name ? normalizeKnownGuideCharacterName(character.name) : null,
    homeLevel: character && Number.isFinite(character.home_level) ? character.home_level : null,
    level: safely(parseLevelPage, pages["角色等级"], { incomplete: true, current: null, target: null }),
    weapon: safely(parseWeaponPage, pages["武器"], {
      incomplete: true, name: null, current: null, target: null, observations: []
    }),
    talents: safely(parseTalentPage, pages["角色天赋"], { incomplete: true, talents: [] })
  };
}

function buildPlanPreview(collection, now, identities) {
  const pageNames = ["角色等级", "武器", "角色天赋"];
  const pagesIncomplete = collection && Array.isArray(collection.characters) &&
    collection.characters.some(function (character) {
      return !character.pages || pageNames.some(function (name) {
        return !character.pages[name] || character.pages[name].incomplete;
      });
    });
  const characterProgress = collection && Array.isArray(collection.characters)
    ? collection.characters.map(parseCharacterProgress) : [];
  const provenanceIssues = [];
  const started = collection && Date.parse(collection.started_at);
  const completed = collection && Date.parse(collection.completed_at);
  const seenSnapshotIds = new Set();
  if (!Number.isFinite(started) || !Number.isFinite(completed) || completed < started) {
    provenanceIssues.push("Collection time range is missing or invalid");
  }
  const evidenceSnapshots = [];
  if (collection && collection.home_snapshot) evidenceSnapshots.push(collection.home_snapshot);
  for (const character of collection && Array.isArray(collection.characters) ? collection.characters : []) {
    for (const page of Object.values(character.pages || {})) {
      for (const snapshot of page && Array.isArray(page.snapshots) ? page.snapshots : []) {
        const sx = snapshot && snapshot.screen ? snapshot.screen.width / 1920 : NaN;
        const sy = snapshot && snapshot.screen ? snapshot.screen.height / 1080 : NaN;
        const headers = snapshot && Array.isArray(snapshot.regions) ? snapshot.regions.filter(function (region) {
          return normalizeKnownGuideCharacterName(region.text) ===
              normalizeKnownGuideCharacterName(character.name) &&
            region.x >= 700 * sx && region.x < 1450 * sx &&
            region.y >= 70 * sy && region.y < 210 * sy;
        }) : [];
        if (headers.length !== 1) provenanceIssues.push(character.name + ": detail snapshot header mismatch");
      }
      Array.prototype.push.apply(evidenceSnapshots, page && Array.isArray(page.snapshots) ? page.snapshots : []);
    }
  }
  for (const snapshot of evidenceSnapshots) {
    const captured = snapshot && Date.parse(snapshot.captured_at);
    if (!validSnapshot(snapshot) || snapshot.run_id !== collection.run_id ||
        typeof snapshot.snapshot_id !== "string" || !snapshot.snapshot_id ||
        seenSnapshotIds.has(snapshot.snapshot_id) || !Number.isFinite(captured) ||
        (Number.isFinite(started) && captured < started) ||
        (Number.isFinite(completed) && captured > completed)) {
      provenanceIssues.push("Snapshot provenance is missing, duplicated, or outside the collection");
      break;
    }
    seenSnapshotIds.add(snapshot.snapshot_id);
  }
  if (Number.isFinite(started) && Number.isFinite(completed) &&
      serverGameDay(new Date(started)) !== serverGameDay(new Date(completed))) {
    provenanceIssues.push("Collection crossed an Asia server-day boundary");
  }
  const homeCharacters = collection && collection.home && Array.isArray(collection.home.characters)
    ? collection.home.characters : [];
  const collectedCharacters = collection && Array.isArray(collection.characters) ? collection.characters : [];
  if (homeCharacters.length !== collectedCharacters.length || homeCharacters.some(function (home, index) {
      const detail = collectedCharacters[index];
      return !detail || normalizeKnownGuideCharacterName(home.name) !==
        normalizeKnownGuideCharacterName(detail.name) || home.level !== detail.home_level;
    })) {
    provenanceIssues.push("Guide home rows do not match collected character details");
  }
  if (!collection || collection.ok !== true || collection.incomplete || pagesIncomplete || provenanceIssues.length ||
      typeof collection.run_id !== "string" || !collection.run_id || !collection.started_at ||
      !collection.completed_at || !collection.home ||
      collection.home.incomplete || !Array.isArray(collection.characters) ||
      collection.characters.length !== collection.home.count) {
    return {
      actionable: false,
      run_id: collection && collection.run_id ? collection.run_id : null,
      error: "Collection is failed, changed, or incomplete",
      issues: provenanceIssues,
      characterProgress: characterProgress
    };
  }
  const issues = [];
  const identityCatalogValid = identities && identities.schemaVersion === 1 &&
    identities.characters && typeof identities.characters === "object" && !Array.isArray(identities.characters) &&
    identities.weapons && typeof identities.weapons === "object" && !Array.isArray(identities.weapons);
  if (!identityCatalogValid) issues.push("Guide identity catalog is missing or invalid");
  for (const character of characterProgress) {
    if (character.name === null) issues.push("Unknown character name");
    for (const [label, detail] of [["level", character.level], ["weapon", character.weapon], ["talents", character.talents]]) {
      if (detail.incomplete) issues.push(character.name + ": " + label + " requires targeted reread");
    }
    if (character.homeLevel === null || character.level.current !== character.homeLevel) {
      issues.push(character.name + ": guide home and current character level disagree or are missing");
    }
    const characterIdentity = identityCatalogValid && character.name !== null
      ? identities.characters[character.name] : null;
    const canonicalTalents = characterIdentity && characterIdentity.talentIdentity === "exact" &&
      Array.isArray(characterIdentity.combatSkills)
      ? characterIdentity.combatSkills.map(function (skill) { return skill && skill.canonicalName; }) : [];
    if (!characterIdentity || characterIdentity.talentIdentity !== "exact" || canonicalTalents.length === 0 ||
        canonicalTalents.some(function (name) {
        return typeof name !== "string" || !name;
      }) || new Set(canonicalTalents).size !== canonicalTalents.length) {
      issues.push(character.name + ": character/talent identity is unknown or ambiguous");
    }
    if (character.weapon.name === null || character.weapon.current === null || character.weapon.target === null) {
      issues.push(character.name + ": unknown current weapon level or target");
    } else if (!identityCatalogValid || !Array.isArray(identities.weapons[character.weapon.name]) ||
        identities.weapons[character.weapon.name].length !== 1) {
      issues.push(character.name + ": weapon identity is unknown or ambiguous");
    }
    if (character.talents.talents.length === 0) {
      issues.push(character.name + ": no talent rows recognized");
    }
    for (const talent of character.talents.talents) {
      if (talent.name === null || talent.displayedCurrent === null || talent.target === null) {
        issues.push(character.name + ": incomplete talent observation");
      } else if (!canonicalTalents.includes(talent.name)) {
        issues.push(character.name + ": talent identity is not an exact canonical match: " + talent.name);
      }
    }
  }
  return {
    actionable: issues.length === 0,
    run_id: collection.run_id,
    evidence_started_at: collection.started_at,
    captured_at: collection.completed_at,
    characterProgress: characterProgress,
    issues: issues
  };
}

// ---- Migrated from bettergi-growth-planner/src/guide-coverage.js ----
function readGuideFrameCoverage(capture, tab) {
  const Size = OpenCvSharp.OpenCvSharp.Size;
  const TemplateMatchModes = OpenCvSharp.OpenCvSharp.TemplateMatchModes;
  const width = Number(capture.Width);
  const height = Number(capture.Height);
  const sx = width / 1920;
  const sy = height / 1080;
  if (Math.abs(sx - sy) > 0.01) {
    throw new Error("提升指南结构识别仅支持16:9画面");
  }

  function findTemplate(assetName, reference, threshold, maxMatches, options) {
    const asset = file.ReadImageMatSync("guide-reader/assets/" + assetName);
    let template = null;
    let recognizer = null;
    const matches = [];
    try {
      if (Number(asset.Width) <= 0 || Number(asset.Height) <= 0) {
        throw new Error("无法读取提升指南结构模板：" + assetName);
      }
      template = asset.Resize(new Size(
        Math.max(1, Math.round(Number(asset.Width) * sx)),
        Math.max(1, Math.round(Number(asset.Height) * sy))));
      recognizer = RecognitionObject.TemplateMatch(template,
        reference.x * sx, reference.y * sy,
        reference.width * sx, reference.height * sy);
      if (options && options.mode) recognizer.TemplateMatchMode = options.mode;
      if (options && options.use3Channels) recognizer.Use3Channels = true;
      recognizer.Threshold = threshold;
      recognizer.MaxMatchCount = maxMatches;
      const found = capture.FindMulti(recognizer);
      try {
        for (let i = 0; i < found.Count; i++) {
          matches.push({
            x: Number(found[i].X),
            y: Number(found[i].Y),
            width: Number(found[i].Width),
            height: Number(found[i].Height),
            score: Number(found[i].MatchScore)
          });
        }
      } finally {
        for (let i = 0; i < found.Count; i++) found[i].Dispose();
      }
    } finally {
      if (recognizer && recognizer.TemplateImageGreyMat) {
        recognizer.TemplateImageGreyMat.Dispose();
      }
      if (template) template.Dispose();
      asset.Dispose();
    }
    matches.sort((a, b) => a.y - b.y || b.score - a.score);
    const rows = [];
    for (const match of matches) {
      const previous = rows.length ? rows[rows.length - 1] : null;
      if (previous && Math.abs(match.y - previous.y) < match.height * 0.7) {
        if (match.score > previous.score) rows[rows.length - 1] = match;
      } else {
        rows.push(match);
      }
    }
    return rows;
  }

  const cardRows = findTemplate("guide_talent_card_arrow.png",
    { x: 1735, y: 300, width: 115, height: 735 }, 0.94, 8);
  const sourceRows = findTemplate("guide_material_source_pin.png",
    { x: 1735, y: 300, width: 115, height: 735 }, 0.94, 12);
  const thumbTop = findTemplate("guide_scroll_thumb_top.png",
    { x: 1840, y: 298, width: 38, height: 55 }, 0.96, 1);
  const thumbEnd = findTemplate("guide_scroll_thumb_end.png",
    { x: 1840, y: 300, width: 38, height: 720 }, 0.96, 1);
  // These uniform/fixed-position signals deliberately use SqDiffNormed. A
  // correlation matcher cannot safely distinguish a near-constant strip.
  const noScrollbar = findTemplate("guide_scroll_absent.png",
    { x: 1850, y: 300, width: 15, height: 721 }, 0.99999, 1,
    { mode: TemplateMatchModes.SqDiffNormed, use3Channels: true });
  const levelNoScrollbar = tab === "角色等级" ? findTemplate("guide_level_scroll_absent.png",
    { x: 1850, y: 300, width: 15, height: 721 }, 0.99999, 1,
    { mode: TemplateMatchModes.SqDiffNormed, use3Channels: true }) : [];
  const thumbAtBottom = findTemplate("guide_scroll_thumb_bottom.png",
    { x: 1850, y: 970, width: 15, height: 51 }, 0.99999, 1,
    { mode: TemplateMatchModes.SqDiffNormed, use3Channels: true });
  const hasNoScrollbar = noScrollbar.length === 1 || levelNoScrollbar.length === 1;
  const hasThumbTop = thumbTop.length === 1;
  const hasThumbEnd = thumbEnd.length === 1;
  const hasThumbBottom = thumbAtBottom.length === 1;
  const hasScrollbar = hasThumbTop || hasThumbEnd || hasThumbBottom;
  const conflicting = (hasNoScrollbar && hasScrollbar) ||
    (hasThumbTop && hasThumbBottom);
  return {
    screen: { width, height },
    cardRows,
    sourceRows,
    scrollbar: {
      observed: conflicting ? null : hasScrollbar ? true : hasNoScrollbar ? false : null,
      shortPage: !conflicting && hasNoScrollbar && !hasScrollbar ? true : null,
      thumbTop: hasThumbTop ? thumbTop[0].y : null,
      thumbBottom: hasThumbEnd
        ? thumbEnd[0].y + Math.round(12 * sy) : null,
      bottomAnchor: hasThumbBottom ? thumbAtBottom[0].y : null,
      atTop: !conflicting && hasThumbTop && !hasThumbBottom ? true : null,
      atBottom: !conflicting && hasThumbBottom && !hasThumbTop ? true : null,
      conflicting
    }
  };
}

function validateGuideFrameCoverage(snapshot, tab) {
  if (tab !== "角色等级" && tab !== "角色天赋" && tab !== "武器") {
    return { ok: null, supported: false, tab,
      issues: ["当前页签没有经过独立结构覆盖验证"] };
  }
  const coverage = snapshot && snapshot.visualCoverage;
  const screen = snapshot && snapshot.screen;
  if (!coverage || !screen || !Array.isArray(snapshot.regions)) {
    return { ok: false, supported: true, tab,
      issues: ["缺少画面结构识别结果"] };
  }
  const sx = Number(screen.width) / 1920;
  const sy = Number(screen.height) / 1080;
  const topEdgeY = 350 * sy;
  const bottomEdgeY = 995 * sy;
  const centerY = item => Number(item.y) + Number(item.height) / 2;
  const splitAtEdges = (items, projectedCenter) => ({
    top: items.filter(item => projectedCenter(item) < topEdgeY),
    complete: items.filter(item => projectedCenter(item) >= topEdgeY &&
      projectedCenter(item) < bottomEdgeY),
    bottom: items.filter(item => projectedCenter(item) >= bottomEdgeY)
  });
  const boundaries = tab === "武器" ? snapshot.regions.filter(region =>
    region.text === "使用率较高的武器参考" && region.x >= 625 * sx && region.x < 1500 * sx &&
    region.y >= 295 * sy && region.y + region.height < 1040 * sy) : [];
  const referenceBoundary = boundaries.length === 1 ? boundaries[0] : null;
  const beforeReferenceBoundary = item => !referenceBoundary ||
    centerY(item) < centerY(referenceBoundary);
  const allArrows = coverage.cardRows || [];
  const pins = splitAtEdges((coverage.sourceRows || []).filter(beforeReferenceBoundary), centerY);
  const allMarkers = snapshot.regions.filter(region =>
    region.x > 1500 * sx && (region.text === "升级至" ||
      /^需要角色突破到\s*\d+\s*阶$/.test(region.text)));
  const sources = splitAtEdges(snapshot.regions.filter(region =>
    region.x >= 780 * sx && region.x < 1500 * sx && region.y > 330 * sy &&
    isGuideMaterialSource(region.text, tab))
    .filter(beforeReferenceBoundary),
    source => centerY(source) + 15 * sy);

  function pair(left, right, expectedRightY, tolerance) {
    const unused = right.slice();
    const pairs = [];
    const unmatchedLeft = [];
    for (const item of left) {
      const expected = expectedRightY(item);
      let best = -1;
      let distance = Infinity;
      for (let i = 0; i < unused.length; i++) {
        const candidateDistance = Math.abs(centerY(unused[i]) - expected);
        if (candidateDistance < distance) {
          best = i;
          distance = candidateDistance;
        }
      }
      if (best >= 0 && distance <= tolerance) {
        pairs.push({ left: item, right: unused[best], distance });
        unused.splice(best, 1);
      } else {
        unmatchedLeft.push(item);
      }
    }
    return { pairs, unmatchedLeft, unmatchedRight: unused };
  }

  let arrows = splitAtEdges(allArrows, centerY);
  let markers = splitAtEdges(allMarkers, marker => centerY(marker) + 33 * sy);
  let cardPairs = { pairs: [], unmatchedLeft: [], unmatchedRight: [] };
  if (tab === "角色天赋") {
    const paired = pair(allMarkers, allArrows,
      marker => centerY(marker) + 33 * sy, 22 * sy);
    const topPairs = paired.pairs.filter(item =>
      centerY(item.right) < topEdgeY ||
      centerY(item.left) + 33 * sy < topEdgeY);
    const bottomPairs = paired.pairs.filter(item =>
      !topPairs.includes(item) && (centerY(item.right) >= bottomEdgeY ||
        centerY(item.left) + 33 * sy >= bottomEdgeY));
    const completePairs = paired.pairs.filter(item =>
      !topPairs.includes(item) && !bottomPairs.includes(item));
    const unmatchedArrows = splitAtEdges(paired.unmatchedRight, centerY);
    const unmatchedMarkers = splitAtEdges(paired.unmatchedLeft,
      marker => centerY(marker) + 33 * sy);
    arrows = {
      top: topPairs.map(item => item.right).concat(unmatchedArrows.top),
      complete: completePairs.map(item => item.right).concat(unmatchedArrows.complete),
      bottom: bottomPairs.map(item => item.right).concat(unmatchedArrows.bottom)
    };
    markers = {
      top: topPairs.map(item => item.left).concat(unmatchedMarkers.top),
      complete: completePairs.map(item => item.left).concat(unmatchedMarkers.complete),
      bottom: bottomPairs.map(item => item.left).concat(unmatchedMarkers.bottom)
    };
    cardPairs = {
      pairs: completePairs,
      unmatchedLeft: unmatchedMarkers.complete,
      unmatchedRight: unmatchedArrows.complete
    };
  }
  const sourcePairs = pair(sources.complete, pins.complete,
    source => centerY(source) + 15 * sy, 20 * sy);
  const issues = [];
  if (coverage.scrollbar && coverage.scrollbar.conflicting === true) {
    issues.push("滚动条结构信号互相冲突");
  }
  if (tab === "角色天赋" && !arrows.complete.length) {
    issues.push("当前帧没有识别到完整天赋卡片");
  }
  if (tab === "角色天赋" &&
      (cardPairs.unmatchedLeft.length || cardPairs.unmatchedRight.length)) {
    issues.push("天赋卡片箭头与升级目标文字未能逐行对应");
  }
  if (sourcePairs.unmatchedLeft.length || sourcePairs.unmatchedRight.length) {
    issues.push("材料来源定位图标与来源文字未能逐行对应");
  }
  const hasUnconfirmedEdge = (tab === "角色天赋" &&
    (arrows.bottom.length > 0 || markers.bottom.length > 0)) ||
    pins.bottom.length > 0 || sources.bottom.length > 0;
  const physicalEnd = coverage.scrollbar &&
    (coverage.scrollbar.shortPage === true || coverage.scrollbar.atBottom === true);
  const scopeComplete = tab === "武器" ? !!referenceBoundary : !!physicalEnd;
  return {
    ok: issues.length === 0,
    frameComplete: issues.length === 0 && !hasUnconfirmedEdge && scopeComplete,
    hasUnconfirmedEdge,
    scopeComplete,
    supported: true,
    tab,
    verified: { cardRows: cardPairs.pairs, sourceRows: sourcePairs.pairs },
    unmatched: {
      cardArrows: cardPairs.unmatchedRight,
      upgradeMarkers: cardPairs.unmatchedLeft,
      sourcePins: sourcePairs.unmatchedRight,
      sourceAnchors: sourcePairs.unmatchedLeft
    },
    topEdge: {
      cardArrows: arrows.top,
      upgradeMarkers: markers.top,
      sourcePins: pins.top,
      sourceAnchors: sources.top
    },
    unconfirmedEdge: {
      cardArrows: arrows.bottom,
      upgradeMarkers: markers.bottom,
      sourcePins: pins.bottom,
      sourceAnchors: sources.bottom
    },
    issues
  };
}

// ---- Migrated from bettergi-growth-planner/src/collect-guide.js ----
function requireCompleteHome(snapshot, parser) {
  const home = parser(snapshot);
  if (!home.ok) throw new Error(home.error);
  if (home.count > home.capacity) throw new Error("Plan count exceeds capacity");
  if (home.incomplete || home.characters.length !== home.count) {
    throw new Error("Enabled-character list is not fully visible");
  }
  return home;
}

function toReferencePoint(point, screen) {
  if (!screen || !(screen.width > 0) || !(screen.height > 0)) {
    throw new Error("Invalid screen geometry");
  }
  return {
    x: point.x * 1920 / screen.width,
    y: point.y * 1080 / screen.height
  };
}

function sameHome(left, right) {
  if (left.count !== right.count || left.capacity !== right.capacity ||
      left.characters.length !== right.characters.length) return false;
  for (let i = 0; i < left.characters.length; i++) {
    if (left.characters[i].name !== right.characters[i].name ||
        left.characters[i].guideStatus !== right.characters[i].guideStatus ||
        left.characters[i].level !== right.characters[i].level) return false;
  }
  return true;
}

function canonicalLevelText(value) {
  const match = String(value || "").match(/^lv\.(\d+)$/i);
  return match ? "Lv." + match[1] : null;
}

function normalizeGuideAnchorText(value) {
  const level = canonicalLevelText(value);
  return level || String(value || "").normalize("NFKC").replace(/\s+/g, "");
}

function sameViewport(left, right) {
  if (!left || !right) return false;
  function anchors(snapshot) {
    return snapshot.regions.map(region => ({
      text: region.text,
      x: region.x * 1920 / snapshot.screen.width,
      y: region.y * 1080 / snapshot.screen.height,
      width: region.width * 1920 / snapshot.screen.width,
      height: region.height * 1080 / snapshot.screen.height
    })).filter(region => region.x >= 625 && region.x < 1870 &&
      region.y >= 310 && region.y < 1040 &&
      (isUpgradeGoalLabel(region.text) ||
       /^(当前武器|使用率较高的武器参考|等级\s*\d+|角色等级方面暂无可提升事项)/.test(region.text) ||
       isGuideMaterialSource(region.text, "角色等级")))
      .map(region => ({ text: normalizeGuideAnchorText(region.text),
        x: region.x + region.width / 2, y: region.y + region.height / 2 }))
      .sort((a, b) => a.y - b.y || a.x - b.x);
  }
  const before = anchors(left);
  const after = anchors(right);
  // Text-box edges and animated quantities jitter even when scrolling has stopped.
  return before.length > 0 && before.length === after.length && before.every((row, i) =>
    row.text === after[i].text && Math.abs(row.x - after[i].x) <= 8 &&
    Math.abs(row.y - after[i].y) <= 8);
}

async function collectGuideSnapshot(recordFrames = false, artifactSampleCharacter = null) {
    const Rect = OpenCvSharp.OpenCvSharp.Rect;
    const page = new BvPage();
    const startedAt = new Date().toISOString();
    const runId = new Date().toISOString().replace(/[-:.TZ]/g, "") + "-" +
      Math.floor(Math.random() * 1000000);
    const sampleDirectory = artifactSampleCharacter ? "record/artifact-guide-samples/" + runId : null;
    const outputPath = path => sampleDirectory ? sampleDirectory + "/" + path : path;
    const sampleDeadline = Date.now() + 90000;
    const sampleToken = artifactSampleCharacter && typeof dispatcher !== 'undefined'
      && typeof dispatcher.GetLinkedCancellationToken === 'function' ? dispatcher.GetLinkedCancellationToken() : null;
    function checkSampleRead() {
      if (!artifactSampleCharacter) return;
      if (sampleToken && typeof sampleToken.ThrowIfCancellationRequested === 'function') sampleToken.ThrowIfCancellationRequested();
      if (Date.now() >= sampleDeadline) {
        const error = new Error('圣遗物推荐采样超过90秒，已停止');
        error.code = 'sample_timeout';
        throw error;
      }
    }
    let snapshotSequence = 0;
    const tabLabelRois1080 = {
      "角色等级": { x: 700, y: 235, width: 220, height: 65 },
      "武器": { x: 1000, y: 235, width: 200, height: 65 },
      "角色天赋": { x: 1570, y: 235, width: 240, height: 65 }
    };
    const tabs = ["角色等级", "武器", "角色天赋"];

    function scaleRect(rect, screen) {
      return new Rect(
        Math.round(rect.x * screen.width / 1920),
        Math.round(rect.y * screen.height / 1080),
        Math.round(rect.width * screen.width / 1920),
        Math.round(rect.height * screen.height / 1080)
      );
    }

    function writeJson(path, value) {
      if (!file.WriteTextSync(outputPath(path), JSON.stringify(value, null, 2))) {
        throw new Error("Failed to write " + path);
      }
    }

    function safeName(value) {
      return String(value).replace(/[\\/:*?"<>|]/g, "_");
    }

    function captureOcr(withDetailCrops = false, tab = null) {
      checkSampleRead();
      const capture = captureGameRegion();
      const output = [];
      try {
        if (artifactSampleCharacter && (Number(capture.Width) !== 1920 || Number(capture.Height) !== 1080)) {
          throw new Error('圣遗物推荐采样目前仅支持1920×1080，请使用16:9默认界面缩放');
        }
        const found = capture.FindMulti(RecognitionObject.OcrThis);
        for (let i = 0; i < found.Count; i++) {
          const region = found[i];
          output.push({
            text: String(region.Text).trim(),
            x: Number(region.X),
            y: Number(region.Y),
            width: Number(region.Width),
            height: Number(region.Height)
          });
          region.Dispose();
        }
        // Confirm small/coloured text at two scales; never infer a missing digit/name.
        function readCrop(reference, pattern, factors = [2, 3], threshold = false) {
          const rect = scaleRect(reference,
            { width: capture.Width, height: capture.Height });
          const crop = capture.DeriveCrop(rect);
          const values = [];
          const readings = [];
          try {
            for (const factor of factors) {
              const resized = crop.SrcMat.Resize(new OpenCvSharp.OpenCvSharp.Size(rect.Width * factor, rect.Height * factor));
              let grey = null;
              let prepared = null;
              if (threshold) {
                grey = resized.CvtColor(OpenCvSharp.OpenCvSharp.ColorConversionCodes.BGR2GRAY);
                prepared = grey.Threshold(180, 255, OpenCvSharp.OpenCvSharp.ThresholdTypes.BinaryInv);
              }
              const enlarged = new ImageRegion(prepared || resized, 0, 0);
              try {
                const digits = enlarged.FindMulti(RecognitionObject.OcrThis);
                const texts = [];
                for (let i = 0; i < digits.Count; i++) {
                  texts.push(String(digits[i].Text).trim());
                  digits[i].Dispose();
                }
                readings.push(texts);
                values.push(texts.length === 1 && pattern.test(texts[0]) ? texts[0] : null);
              } finally {
                enlarged.Dispose();
                if (grey) grey.Dispose();
                if (threshold) resized.Dispose();
              }
            }
            const recognized = values.filter(value => value !== null);
            if (threshold || recognized.length < 2 || !recognized.every(value => value === recognized[0])) {
              const path = "raw/crop-" + runId + "-" + (snapshotSequence + 1) + "-" + rect.X + "-" + rect.Y;
              writeJson(path + ".json", { reference: reference, factors: factors, threshold: threshold ? 180 : null, readings: readings });
              if (!file.WriteImageSync(outputPath(path + ".png"), crop.SrcMat)) log.Warn("无法保存局部识别取证：{0}", path);
            }
          } finally { crop.Dispose(); }
          const recognized = values.filter(value => value !== null);
          return recognized.length >= 2 && recognized.every(value => value === recognized[0]) ? {
            text: recognized[0], x: rect.X, y: rect.Y, width: rect.Width, height: rect.Height,
            source: threshold ? "crop-contrast-two-scales" : "crop-two-scales"
          } : null;
        }
        const sx = capture.Width / 1920;
        const sy = capture.Height / 1080;
        const homeHeader = output.find(r => /^培养计划角色列表[（(]\d+\/\d+[）)]$/.test(r.text));
        if (homeHeader) {
          const partyHeader = output.find(r => /^队伍内角色实力/.test(r.text));
          const upgradeButtons = output.filter(r => r.text === "提升" && r.x > 1550 * sx &&
            r.y > homeHeader.y && (!partyHeader || r.y < partyHeader.y));
          for (const button of upgradeButtons) {
            if (output.some(r => /^(培养中|已完成)$/.test(r.text) &&
                Math.abs(r.y - (button.y - 40 * sy)) < 20 * sy)) continue;
            const badge = readCrop({ x: 1577, y: button.y / sy - 50, width: 80, height: 45 }, /^(培养中|已完成)$/);
            if (badge) output.push(badge);
          }
          const badges = output.filter(r => /^(培养中|已完成)$/.test(r.text) && r.y > homeHeader.y &&
            (!partyHeader || r.y < partyHeader.y));
          for (const badge of badges) {
            if (output.some(r => canonicalLevelText(r.text) !== null && r.x >= 620 * sx && r.x < 850 * sx &&
                r.y > badge.y + 55 * sy && r.y < badge.y + 135 * sy)) continue;
            const level = readCrop({ x: 670, y: badge.y / sy + 75, width: 110, height: 60 }, /^lv\.\d+$/i);
            if (level) {
              level.text = canonicalLevelText(level.text);
              output.push(level);
            }
          }
        }
        // Completed weapons have no upgrade-goal label; anchor their level to the current-weapon heading.
        const weaponHeading = withDetailCrops && output.find(r =>
          r.text === "强化当前武器" && r.x >= 625 * sx && r.y > 290 * sy && r.y < 800 * sy);
        if (weaponHeading && !output.some(r => canonicalLevelText(r.text) !== null &&
            r.x >= 620 * sx && r.x < 780 * sx &&
            r.y > weaponHeading.y && r.y < weaponHeading.y + 165 * sy)) {
          const current = readCrop({ x: 680, y: weaponHeading.y / sy + 110,
            width: 80, height: 35 }, /^lv\.\d+$/i, [1, 2, 3]);
          if (current) {
            current.text = canonicalLevelText(current.text);
            output.push(current);
          }
        }
        const markers = !withDetailCrops ? [] : output.filter(r => isUpgradeGoalLabel(r.text) && r.y > 290 * sy && r.y < 935 * sy);
        for (const marker of markers) {
          const top = marker.y / sy;
          // The full-frame detector merges cyan "11" into "1". Always read the
          // isolated number, excluding the neighbouring +/- controls. A failed
          // contrast read stays unknown; a plausible full-frame digit is no fallback.
          for (let i = output.length - 1; i >= 0; i--) {
            const r = output[i];
            if (/^\d+$/.test(r.text) && r.x > 1500 * sx &&
                r.y >= marker.y && r.y < marker.y + 100 * sy) output.splice(i, 1);
          }
          const target = readCrop({ x: 1605, y: top + 20, width: 70, height: 65 }, /^\d{1,3}$/, [2, 3], true);
          if (target) output.push(target);
          if (tab === "角色等级") continue;
          if (!output.some(r => canonicalLevelText(r.text) !== null && r.x >= 620 * sx && r.x < 780 * sx &&
              r.y >= marker.y && r.y < marker.y + 105 * sy)) {
            // Large scaling can hide this tiny white-on-dark level strip from the detector.
            const current = readCrop({ x: 680, y: top + 65, width: 80, height: 35 }, /^lv\.\d+$/i, [1, 2, 3]);
            if (current) {
              current.text = canonicalLevelText(current.text);
              output.push(current);
            }
          }
          const name = readCrop({ x: 772, y: top + 10, width: 430, height: 45 }, /^[\u3400-\u9fff·「」]{2,30}$/);
          if (name) {
            const originalNames = output.filter(r => r.x >= 772 * sx && r.x < 1202 * sx &&
              r.y >= (top + 10) * sy && r.y < (top + 55) * sy && /^[\u3400-\u9fff·「」]{2,30}$/.test(r.text) &&
              !/^(已达|升级材料|材料不足|可升级|升级至)/.test(r.text));
            // Preserve disagreeing evidence. Cropping must not silently replace
            // a full-frame name with a different valid-looking string.
            if (originalNames.some(r => r.text !== name.text)) continue;
            name.fullFrameTexts = originalNames.map(r => r.text);
            for (let i = output.length - 1; i >= 0; i--) {
              if (originalNames.includes(output[i])) output.splice(i, 1);
            }
            output.push(name);
          }
        }
        const snapshotId = runId + "-" + (++snapshotSequence);
        // Full-frame archives are for read-only diagnosis. Daily spending keeps
        // OCR/structure and targeted crops without accumulating hundreds of PNGs.
        const imagePath = recordFrames ? outputPath("raw/frame-" + snapshotId + ".png") : null;
        if (imagePath && !file.WriteImageSync(imagePath, capture.SrcMat)) throw new Error("无法保存读取证据截图");
        const snapshot = {
          ok: true,
          run_id: runId,
          snapshot_id: snapshotId,
          imagePath: imagePath,
          captured_at: new Date().toISOString(),
          screen: { width: Number(capture.Width), height: Number(capture.Height) },
          visualCoverage: withDetailCrops ? readGuideFrameCoverage(capture, tab) : null,
          regions: output
        };
        if (artifactSampleCharacter) writeJson('raw/frame-' + snapshotId + '.json', snapshot);
        return snapshot;
      } finally {
        capture.Dispose();
      }
    }

    async function openGuideHome() {
      let snapshot = captureOcr();
      if (parseGuideHome(snapshot).ok) return snapshot;
      await genshin.ReturnMainUi();
      checkSampleRead();
      keyPress("VK_ESCAPE");
      await sleep(1000);
      const guide = page.GetByText("提升指南", new Rect(80, 310, 690, 680)).FindAll();
      try {
        if (guide.Count !== 1 || String(guide[0].Text).trim() !== "提升指南") {
          throw new Error("派蒙菜单中没有唯一的提升指南入口");
        }
        checkSampleRead();
        guide[0].Click();
      } finally { for (let i = 0; i < guide.Count; i++) guide[i].Dispose(); }
      for (let attempt = 0; attempt < 6; attempt++) {
        await sleep(700);
        snapshot = captureOcr();
        if (parseGuideHome(snapshot).ok) break;
      }
      writeJson("raw/guide-entry.json", snapshot);
      if (artifactSampleCharacter) {
        const parsed = parseGuideHome(snapshot);
        if (!parsed.ok) throw new Error('无法确认提升指南首页：' + parsed.error);
      } else requireCompleteHome(snapshot, parseGuideHome);
      return snapshot;
    }

    function requireCharacterHeader(snapshot, name) {
      const sx = snapshot.screen.width / 1920;
      const sy = snapshot.screen.height / 1080;
      const matches = snapshot.regions.filter(function (region) {
        return normalizeKnownGuideCharacterName(region.text) === normalizeKnownGuideCharacterName(name) &&
          region.x >= 700 * sx && region.x < 1450 * sx &&
          region.y >= 70 * sy && region.y < 210 * sy;
      });
      if (matches.length !== 1) {
        throw new Error(artifactSampleCharacter ? '角色详情标题无法确认或与所选角色不一致：' + name
          : 'Detail header does not match selected character: ' + name);
      }
    }

    function clickExactTab(label, screen, referenceOverride = null) {
      checkSampleRead();
      const referenceRoi = referenceOverride || tabLabelRois1080[label];
      if (!referenceRoi) throw new Error("Unknown guide tab label: " + label);
      const roi = scaleRect(referenceRoi, screen);
      const found = page.GetByText(label, roi).FindAll();
      const exact = [];
      try {
        for (let i = 0; i < found.Count; i++) {
          const observed = String(found[i].Text).trim().normalize("NFKC");
          const match = observed.match(/^[^\u3400-\u9fff]*([\u3400-\u9fff]+)$/);
          if (match && match[1] === label) exact.push(found[i]);
        }
        if (exact.length !== 1) {
          const candidates = [];
          for (let i = 0; i < found.Count; i++) {
            candidates.push({
              text: String(found[i].Text), x: Number(found[i].X), y: Number(found[i].Y),
              width: Number(found[i].Width), height: Number(found[i].Height)
            });
          }
          writeJson("raw/tab-click-failure-" + runId + "-" + safeName(label) + ".json", {
            label: label,
            screen: screen,
            reference_roi: referenceRoi,
            scaled_roi: { x: Number(roi.X), y: Number(roi.Y), width: Number(roi.Width), height: Number(roi.Height) },
            candidates: candidates
          });
          throw new Error(artifactSampleCharacter ? '无法找到唯一的圣遗物页签，请检查OCR V6；已停止采样'
            : 'Expected one exact tab label: ' + label);
        }
        exact[0].Click();
        return { text: label, x: Number(exact[0].X), y: Number(exact[0].Y),
          width: Number(exact[0].Width), height: Number(exact[0].Height), referenceRoi };
      } finally {
        for (let i = 0; i < found.Count; i++) found[i].Dispose();
      }
    }

    /** 复用原角色入口及教学提示处理，采样只打开一个目标角色。 */
    async function openCharacterDetail(character, homeSnapshot) {
      checkSampleRead();
      const point = toReferencePoint(character.upgradePoint, homeSnapshot.screen);
      page.Click(point.x, point.y);
      await sleep(900);
      let opened = captureOcr();
      for (let tutorial = 0; tutorial < 3; tutorial++) {
        const teaching = opened.regions.some(r => r.y > opened.screen.height * 0.65 &&
          (r.text.includes('设定完成后') || r.text.includes('计划培养的角色') ||
           r.text.includes('主要产出途径') || r.text.includes('在材料详情中，也可查看')));
        if (!teaching) break;
        checkSampleRead();
        page.Click(960, 1020);
        await sleep(700);
        opened = captureOcr();
      }
      requireCharacterHeader(opened, character.name);
      return opened;
    }

    async function wheelRightPane(screen, direction, count) {
      moveMouseTo(
        Math.round(1840 * screen.width / 1920),
        Math.round(900 * screen.height / 1080)
      );
      for (let wheel = 0; wheel < count; wheel++) {
        verticalScroll(direction);
        await sleep(20);
      }
      await sleep(500);
    }

    function hasPageTop(snapshot, tab) {
      if (tab === "角色等级") return pageRegions({ snapshots: [snapshot] }).some(region =>
        region.x >= 625 && region.x < 1500 &&
        ((region.y >= 300 && region.y < 450 && /^等级\s*\d+(?:\s*\/\s*\d+)?$/.test(region.text)) ||
          (region.y >= 300 && region.y < 950 &&
            region.text === "角色等级方面暂无可提升事项，可查看其他提升事项")));
      const title = tab === "武器" ? "强化当前武器" : "推荐提升天赋等级";
      return pageRegions({ snapshots: [snapshot] }).some(region => region.text === title &&
        region.x >= 625 && region.x < 1250 && region.y >= 300 && region.y < 350);
    }

    async function resetRightPaneToTop(characterName, screen, tab) {
      let previous = captureOcr();
      requireCharacterHeader(previous, characterName);
      for (let verification = 0; verification < 12; verification++) {
        await wheelRightPane(screen, 1, 12);
        const current = captureOcr();
        requireCharacterHeader(current, characterName);
        if (sameViewport(current, previous) && hasPageTop(current, tab)) return true;
        previous = current;
      }
      return false;
    }

    async function collectScrollablePage(characterName, screen, tab, homeLevel) {
      const snapshots = [];
      const topResetConfirmed = await resetRightPaneToTop(characterName, screen, tab);
      if (!topResetConfirmed) throw new Error(characterName + "：无法确认" + tab + "页面顶部");
      let previous = null;
      let complete = false;
      const coverageIssues = [];
      const identity = GUIDE_IDENTITIES.characters[normalizeKnownGuideCharacterName(characterName)];
      const talentNames = identity && Array.isArray(identity.combatSkills)
        ? identity.combatSkills.map(skill => skill.canonicalName) : [];
      function scrollShift(left, right) {
        function anchors(snapshot) {
          const regions = pageRegions({ snapshots: [snapshot] });
          const verified = snapshot.coverage && snapshot.coverage.ok && snapshot.coverage.verified;
          if (!verified) return [];
          const sy = 1080 / snapshot.screen.height;
          // Edge labels can survive while their card/name is clipped. Only
          // physically paired, complete rows may establish scroll distance.
          const goalRows = verified.cardRows.map(pair => ({ y: pair.left.y * sy }));
          return regions.map(region => {
            let identity = null;
            if (talentNames.includes(region.text) && goalRows.some(marker =>
                region.y >= marker.y && region.y < marker.y + 105)) {
              identity = "talent:" + region.text;
            }
            else if (GUIDE_IDENTITIES.weapons[region.text]) identity = "weapon:" + region.text;
            else if (isGuideMaterialSource(region.text, tab) && verified.sourceRows.some(pair =>
                normalizeGuideAnchorText(pair.left.text) === normalizeGuideAnchorText(region.text) &&
                Math.abs((pair.left.y + pair.left.height / 2) * sy - region.y - region.height / 2) < 1)) {
              identity = "source:" + normalizeGuideAnchorText(region.text);
            }
            return { region: region, identity: identity };
          }).filter(item => item.identity !== null && item.region.x >= 625 && item.region.x < 1500 &&
            item.region.y >= 295 && item.region.y < 1040);
        }
        const before = anchors(left), after = anchors(right), shifts = [];
        for (const anchor of before) {
          const matches = after.filter(item => item.identity === anchor.identity);
          if (matches.length === 1 && before.filter(item => item.identity === anchor.identity).length === 1) {
            // Crop-backed names have taller boxes than full-frame OCR. Their
            // centers agree; top edges can invent a conflicting scroll distance.
            shifts.push(matches[0].region.y + matches[0].region.height / 2 -
              anchor.region.y - anchor.region.height / 2);
          }
        }
        return shifts.length && shifts.every(shift => Math.abs(shift - shifts[0]) <= 12) ? shifts[0] : null;
      }
      for (let pass = 0; pass < 16; pass++) {
        const snapshot = captureOcr(true, tab);
        requireCharacterHeader(snapshot, characterName);
        snapshots.push(snapshot);
        await sleep(350);
        const confirmation = captureOcr(true, tab);
        requireCharacterHeader(confirmation, characterName);
        confirmation.confirmation_of = snapshot.snapshot_id;
        snapshots.push(confirmation);
        if (!sameViewport(snapshot, confirmation)) throw new Error("读取时页面仍在移动：" + characterName + tab);
        snapshot.coverage = validateGuideFrameCoverage(snapshot, tab);
        confirmation.coverage = validateGuideFrameCoverage(confirmation, tab);
        for (const frame of [snapshot, confirmation]) {
          if (!frame.coverage.ok) coverageIssues.push({ snapshot: frame.snapshot_id, issues: frame.coverage.issues });
        }
        if (sameViewport(snapshot, previous)) {
          complete = snapshot.coverage.frameComplete && confirmation.coverage.frameComplete;
          break;
        }
        if (previous) {
          const shift = scrollShift(previous, snapshot);
          if (shift === null || shift >= 0 || shift < -600) {
            coverageIssues.push({ snapshot: snapshot.snapshot_id, issues: ["无法用重叠内容证明连续向下滚动"] });
          }
        }
        // Weapon recommendations are outside the current-weapon demand scope.
        if (snapshot.coverage.frameComplete && confirmation.coverage.frameComplete) {
          complete = true;
          break;
        }
        previous = snapshot;
        await wheelRightPane(snapshot.screen, -1, 6);
      }
      for (const snapshot of snapshots) {
        for (const [edgeKey, textKey, verifiedKey, offset] of [
          ["cardArrows", "upgradeMarkers", "cardRows", 33], ["sourcePins", "sourceAnchors", "sourceRows", 15]
        ]) {
          if (tab !== "角色天赋" && edgeKey === "cardArrows") continue;
          const edges = (snapshot.coverage.topEdge[edgeKey] || [])
            .concat(snapshot.coverage.unconfirmedEdge[edgeKey] || []);
          for (const text of (snapshot.coverage.topEdge[textKey] || [])
              .concat(snapshot.coverage.unconfirmedEdge[textKey] || [])) {
            edges.push({ y: text.y + offset * snapshot.screen.height / 1080, height: text.height });
          }
          for (const edge of edges) {
            const resolved = snapshots.some(other => {
              if (other === snapshot || !other.coverage.ok) return false;
              const shift = scrollShift(snapshot, other);
              if (shift === null) return false;
              const y = (edge.y + edge.height / 2) * 1080 / snapshot.screen.height + shift;
              return other.coverage.verified[verifiedKey].some(pair =>
                Math.abs((pair.right.y + pair.right.height / 2) * 1080 / other.screen.height - y) <= 15);
            });
            if (!resolved) coverageIssues.push({ snapshot: snapshot.snapshot_id,
              issues: ["边缘培养卡片或材料来源未在其它画面完整确认"] });
          }
        }
      }
      const result = {
        home_level: homeLevel,
        incomplete: !topResetConfirmed || !complete || coverageIssues.length > 0,
        top_reset_confirmed: topResetConfirmed,
        snapshots: snapshots,
        coverage_issues: coverageIssues,
        end_confirmed: complete
      };
      const parsed = tab === "角色等级" ? parseLevelPage(result) :
        tab === "武器" ? parseWeaponPage(result) : parseTalentPage(result);
      result.incomplete = result.incomplete || parsed.incomplete;
      result.needs_reread = parsed.needsReread || [];
      return result;
    }

    function saveFailureScreenshot() {
      let capture = null;
      try {
        capture = captureGameRegion();
        const failurePath = outputPath("collection-failure.png");
        if (!file.WriteImageSync(failurePath, capture.SrcMat)) {
          log.Warn("Could not save collection-failure.png");
          return null;
        }
        return failurePath;
      } catch (screenshotError) {
        log.Warn("Could not capture failure screenshot: {0}", String(screenshotError));
      } finally {
        if (capture !== null) capture.Dispose();
      }
    }

    if (artifactSampleCharacter) {
      file.CreateDirectory(sampleDirectory + '/raw');
      return collectArtifactRecommendationSample({
        characterName: artifactSampleCharacter, runId, directory: sampleDirectory, startedAt,
        version: String(getVersion()), openHome: openGuideHome,
        findCharacter: snapshot => {
          const parsed = parseGuideHome(snapshot);
          if (!parsed.ok) throw new Error('无法确认指南角色列表：' + parsed.error);
          return parsed.characters.find(item => normalizeKnownGuideCharacterName(item.name) === artifactSampleCharacter);
        },
        openCharacter: openCharacterDetail,
        // 搜索已知共用页签栏，不预设推荐卡片的未知内部坐标。
        clickArtifactTab: screen => clickExactTab('圣遗物', screen, { x: 625, y: 210, width: 1250, height: 110 }),
        capture: () => captureOcr(), requireCharacterHeader,
        returnMainUi: () => genshin.ReturnMainUi(), wait: delay => sleep(delay),
        checkCancellation: () => {
          if (sampleToken && typeof sampleToken.ThrowIfCancellationRequested === 'function') sampleToken.ThrowIfCancellationRequested();
        },
        saveFailureScreenshot,
        save: report => writeJson('sample.json', report),
      });
    }

    try {
      writeJson("collection.json", {
        ok: false, incomplete: true, status: "reading", run_id: runId, started_at: startedAt
      });
      writeJson("preview.json", {
        actionable: false, status: "reading", run_id: runId, started_at: startedAt
      });
      file.CreateDirectory("raw");
      const firstSnapshot = await openGuideHome();
      const firstHome = requireCompleteHome(firstSnapshot, parseGuideHome);
      writeJson("raw/home.json", firstSnapshot);

      const collection = {
        ok: true,
        run_id: runId,
        started_at: startedAt,
        collected_at: new Date().toISOString(),
        bgi_version: String(getVersion()),
        home: firstHome,
        home_snapshot: firstSnapshot,
        page_names: tabs,
        characters: []
      };

      for (let i = 0; i < firstHome.characters.length; i++) {
        const character = firstHome.characters[i];
        const opened = await openCharacterDetail(character, firstSnapshot);
        const pages = {};
        const directory = "raw/" + safeName(character.name);
        file.CreateDirectory(directory);

        for (let j = 0; j < tabs.length; j++) {
          const tab = tabs[j];
          clickExactTab(tab, opened.screen);
          await sleep(700);
          const pageCollection = await collectScrollablePage(
            character.name, opened.screen, tab, character.level);
          pages[tab] = pageCollection;
          writeJson(directory + "/" + safeName(tab) + ".json", pageCollection);
        }

        collection.characters.push({
          name: character.name,
          home_level: character.level,
          pages: pages
        });
        writeJson(directory + "/character.json", collection.characters[collection.characters.length - 1]);
        log.Info("Collected guide pages for {0} ({1}/{2})", character.name, i + 1, firstHome.count);

        keyPress("VK_ESCAPE");
        await sleep(900);
        let returnedSnapshot = captureOcr();
        for (let attempt = 0; attempt < 2 && !parseGuideHome(returnedSnapshot).ok; attempt++) {
          await sleep(500);
          returnedSnapshot = captureOcr();
        }
        writeJson(directory + "/return-home.json", returnedSnapshot);
        const returnedHome = requireCompleteHome(returnedSnapshot, parseGuideHome);
        if (!sameHome(firstHome, returnedHome)) {
          throw new Error("Guide home changed after collecting " + character.name);
        }
      }

      collection.completed_at = new Date().toISOString();
      collection.collected_at = collection.completed_at;
      collection.incomplete = collection.characters.some(function (character) {
        return tabs.some(function (tab) { return character.pages[tab].incomplete; });
      });
      writeJson("collection.json", collection);
      writeJson("preview.json", buildPlanPreview(collection, new Date(), GUIDE_IDENTITIES));
      log.Info(
        "Guide collection finished: {0} enabled characters; incomplete={1}",
        collection.characters.length,
        collection.incomplete
      );
      return collection;
    } catch (error) {
      const failureMessage = String(error && error.message ? error.message : error);
      try {
        writeJson("collection.json", {
          ok: false,
          incomplete: true,
          run_id: runId,
          started_at: startedAt,
          failed_at: new Date().toISOString(),
          error: failureMessage
        });
      } catch (invalidationError) {
        log.Error("Could not invalidate collection.json: {0}", String(invalidationError));
      }
      try {
        writeJson("preview.json", {
          actionable: false,
          run_id: runId,
          error: failureMessage
        });
      } catch (invalidationError) {
        log.Error("Could not invalidate preview.json: {0}", String(invalidationError));
      }
      saveFailureScreenshot();
      log.Error("Guide collection failed: {0}", failureMessage);
      throw error;
    }
}


/**
 * Read one complete live Training Guide snapshot.
 *
 * The returned objects retain raw run/snapshot provenance. Constructing
 * upstream targets belongs to core/guide-targets.js.
 */
export async function readTrainingGuideSnapshot() {
  GUIDE_IDENTITIES = readGuideJson("guide-reader/data/guide-identities.json");

  let readError = null;
  try {
    const collection = await collectGuideSnapshot(false);
    const preview = buildPlanPreview(collection, new Date(), GUIDE_IDENTITIES);

    if (collection.ok !== true || collection.incomplete !== false || !preview ||
        preview.run_id !== collection.run_id ||
        preview.evidence_started_at !== collection.started_at ||
        preview.captured_at !== collection.completed_at) {
      const previewIssues = preview && Array.isArray(preview.issues) ?
        preview.issues.filter(Boolean) : [];
      const incompletePages = collection && Array.isArray(collection.characters) ?
        collection.characters.flatMap(character => Object.entries(character.pages || {})
          .filter(entry => entry[1] && entry[1].incomplete === true)
          .map(entry => String(character.name || "未知角色") + entry[0] + "读取不完整")) : [];
      const details = previewIssues.length ? previewIssues :
        (incompletePages.length ? incompletePages :
          [preview && preview.error || "unknown guide error"]);
      throw new Error("提升指南读取不完整：" + details.join("；"));
    }
    return { collection: normalizeGuideCollectionCharacterNames(collection), preview };
  } catch (error) {
    readError = error;
    throw error;
  } finally {
    try {
      await genshin.ReturnMainUi();
    } catch (returnError) {
      if (!readError) throw returnError;
      log.Error("提升指南读取失败后返回主界面也失败：{0}",
        String(returnError && returnError.message ? returnError.message : returnError));
    }
  }
}

/** 同一脚本入口的只读推荐页采样；不读取其他角色和培养页，不修改旧指南记录。 */
export async function readTrainingGuideArtifactSample(characterName) {
  const name = normalizeKnownGuideCharacterName(String(characterName ?? '').trim());
  GUIDE_IDENTITIES = readGuideJson('guide-reader/data/guide-identities.json');
  if (!name || !Object.hasOwn(GUIDE_IDENTITIES.characters ?? {}, name)) {
    throw new Error('圣遗物推荐采样必须选择目录中有效的角色');
  }
  return collectGuideSnapshot(true, name);
}
