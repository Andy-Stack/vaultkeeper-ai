import { isSafe } from "redos-detector";
import { Exception } from "./Exception";
import { parseRegExpLiteral, RegExpParser, type AST } from "@eslint-community/regexpp";

export abstract class RegexTools {

    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment -- regex-parser is a CommonJS module without ESM support
    private static RegexParser: (input: string) => RegExp = require("regex-parser");

    public static asRegex(input: string, requiredFlags: string[]): RegExp | Error {
      let parsed: RegExp;
      try {
          parsed = this.RegexParser(input);
      } catch {
          // Not valid regex syntax: treat the input as literal text.
          parsed = new RegExp(this.escapeRegex(input));
      }
  
      let flags = parsed.flags;
      for (const flag of requiredFlags) {
          if (!flags.includes(flag)) flags += flag;
      }
  
      return this.compileSearchPattern(parsed.source, flags);
    }

    // Builds a regex from a string that matches flexibly on whitespace but strictly on all other characters.
    public static toWhitespaceFlexibleRegex(input: string): RegExp {
      const pattern = this.escapeRegex(input).replace(/(\\\s|\s)+/g, "\\s+");
      return new RegExp(pattern);
    }

    public static escapeRegex(string: string): string {
      return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }

    private static compileSearchPattern(source: string, flags = ""): RegExp | Error {
      let regex: RegExp;
      try {
          regex = new RegExp(source, flags);
      } catch (error) {
          return Exception.new(error);
      }

      const safety = isSafe(regex, { timeout: 500 });
      if (!safety.safe) {
          return Exception.new(`Pattern is vulnerable to catastrophic backtracking (ReDoS): ${source}`);
      }

      if (regex.test("")) {
          return Exception.new("");
      }

      return regex;
    }

    // START - Authored by Claude Fable 5.1 on 12/09/2026
    
    private static readonly parser = new RegExpParser();

    public static extractRegexLiterals(pattern: string | RegExp): string[] {
      const root =
        pattern instanceof RegExp
          ? parseRegExpLiteral(pattern).pattern
          : this.parser.parsePattern(pattern, 0, pattern.length, { unicode: false });
    
      const literals: string[] = [];
      let run = "";
      const flush = () => {
        if (run) literals.push(run);
        run = "";
      };
    
      const walkAlternatives = (alts: readonly AST.Alternative[]) => {
        for (const alt of alts) {
          walk(alt.elements);
          flush();
        }
      };
    
      const walk = (elements: readonly AST.Element[]) => {
        for (const el of elements) {
          switch (el.type) {
            case "Character":
              run += String.fromCodePoint(el.value);
              break;
    
            case "Quantifier":
              if (el.min === 0) flush(); // optional atom: drop it, break the run
              else if (el.element.type === "Character") {
                run += String.fromCodePoint(el.element.value).repeat(el.min);
                if (el.max !== el.min) flush();
              } else {
                walk([el.element]);
                flush();
              }
              break;
    
            case "Group":
            case "CapturingGroup":
              flush();
              walkAlternatives(el.alternatives);
              break;
    
            case "Assertion":
              flush();
              if ((el.kind === "lookahead" || el.kind === "lookbehind") && !el.negate)
                walkAlternatives(el.alternatives);
              break;
    
            case "CharacterSet":
            case "CharacterClass":
            case "ExpressionCharacterClass":
            case "Backreference":
              flush();
              break;
          }
        }
      };
    
      walkAlternatives(root.alternatives);
      flush();
      return literals;
    }

    // END - Authored by Claude Fable 5.1 on 12/09/2026

}