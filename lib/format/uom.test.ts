import { describe, expect, it } from "vitest";
import {
  formatCasesHelper,
  formatPackChip,
  formatQtyWithUom,
  parseUom,
} from "@/lib/format/uom";

describe("parseUom", () => {
  it("parses pack ratios from schedule codes", () => {
    expect(parseUom("12X1").unitsPerCase).toBe(12);
    expect(parseUom("ACC_12X1").unitsPerCase).toBe(12);
    expect(parseUom("CAS-6X1").unitsPerCase).toBe(6);
    expect(parseUom("ACC_24X1").unitsPerCase).toBe(24);
    expect(parseUom("CAS-3X1").unitsPerCase).toBe(3);
  });

  it("normalises EACH / UNIT to ea with no case", () => {
    for (const value of ["EACH", "UNIT", "Each"]) {
      expect(parseUom(value)).toMatchObject({
        baseUnit: "ea",
        unitsPerCase: null,
        label: "ea",
      });
    }
  });

  it("keeps clean word units as lowercased labels", () => {
    expect(parseUom("PAIL")).toMatchObject({
      baseUnit: "pail",
      unitsPerCase: null,
      label: "pail",
    });
    expect(parseUom("Set")).toMatchObject({
      label: "set",
      unitsPerCase: null,
    });
    expect(parseUom("Pair")).toMatchObject({
      label: "pair",
      unitsPerCase: null,
    });
  });

  it("suppresses unparseable schedule codes", () => {
    for (const value of ["CAS-55GL", "RAWMAT_2", "TUBE H-K", "TB-W-BLADE"]) {
      expect(parseUom(value)).toMatchObject({
        baseUnit: "ea",
        unitsPerCase: null,
        label: "",
      });
    }
  });

  it("defaults safely for null/empty", () => {
    expect(parseUom(null)).toEqual({
      baseUnit: "ea",
      unitsPerCase: null,
      raw: "",
      label: "",
    });
    expect(parseUom("")).toEqual({
      baseUnit: "ea",
      unitsPerCase: null,
      raw: "",
      label: "",
    });
    expect(parseUom(undefined)).toEqual({
      baseUnit: "ea",
      unitsPerCase: null,
      raw: "",
      label: "",
    });
  });

  it("preserves raw and uses ea label for pack codes", () => {
    expect(parseUom("ACC_12X1")).toEqual({
      baseUnit: "ea",
      unitsPerCase: 12,
      raw: "ACC_12X1",
      label: "ea",
    });
  });
});

describe("formatQtyWithUom", () => {
  it("shows plain numbers for each by default", () => {
    expect(formatQtyWithUom(1131, "EACH")).toBe("1,131");
    expect(formatQtyWithUom(1131, "ACC_12X1")).toBe("1,131");
  });

  it("can show ea suffix when requested", () => {
    expect(formatQtyWithUom(1131, "EACH", { showEachSuffix: true })).toBe(
      "1,131 ea"
    );
  });

  it("shows non-trivial unit suffixes", () => {
    expect(formatQtyWithUom(12, "PAIL")).toBe("12 pail");
  });

  it("never shows raw schedule codes as suffixes", () => {
    expect(formatQtyWithUom(5, "CAS-55GL")).toBe("5");
    expect(formatQtyWithUom(5, "RAWMAT_2")).toBe("5");
  });
});

describe("formatCasesHelper", () => {
  it("formats exact and approximate case counts", () => {
    expect(formatCasesHelper(24, 12)).toBe("= 2 cases");
    expect(formatCasesHelper(12, 12)).toBe("= 1 case");
    expect(formatCasesHelper(20, 12)).toBe("~2 cases (20 units)");
  });
});

describe("formatPackChip", () => {
  it("formats the compact pack chip", () => {
    expect(formatPackChip(12)).toBe("12/cs");
  });
});
