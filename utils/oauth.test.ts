import { expect, test } from "vitest";
import { buildOAuthHeader, buildParamString, hmacSha1, percentEncode } from "@/utils/oauth.ts";

// ---------------------------------------------------------------------------
// percentEncode
// ---------------------------------------------------------------------------

test("percentEncode: leaves unreserved characters unchanged", () => {
  expect(percentEncode("abcABC123-._~")).toEqual("abcABC123-._~");
});

test("percentEncode: encodes spaces and common special chars", () => {
  expect(percentEncode("hello world")).toEqual("hello%20world");
  expect(percentEncode("a=b&c=d")).toEqual("a%3Db%26c%3Dd");
  expect(percentEncode("http://example.com/path")).toEqual("http%3A%2F%2Fexample.com%2Fpath");
});

test("percentEncode: encodes characters that encodeURIComponent leaves unencoded", () => {
  // OAuth requires !'()* to be encoded; encodeURIComponent skips them.
  expect(percentEncode("!")).toEqual("%21");
  expect(percentEncode("'")).toEqual("%27");
  expect(percentEncode("(")).toEqual("%28");
  expect(percentEncode(")")).toEqual("%29");
  expect(percentEncode("*")).toEqual("%2A");
});

test("percentEncode: uses uppercase hex digits", () => {
  // e.g. space → %20 not %2f
  expect(percentEncode("/")).toEqual("%2F");
  expect(percentEncode(":")).toEqual("%3A");
});

// ---------------------------------------------------------------------------
// hmacSha1
// ---------------------------------------------------------------------------

// Test vector from RFC 2202 §3 test case 2:
//   Key  : "Jefe"
//   Data : "what do ya want for nothing?"
//   HMAC : 0xeffcdf6ae5eb2fa2d27416d5f184df9c259a7c79
test("hmacSha1: matches RFC 2202 test vector", async () => {
  const result = await hmacSha1("Jefe", "what do ya want for nothing?");
  // Base64 of the 20-byte digest above
  expect(result).toEqual("7/zfauXrL6LSdBbV8YTfnCWafHk=");
});

// ---------------------------------------------------------------------------
// buildParamString
// ---------------------------------------------------------------------------

test("buildParamString: sorts by ascending byte value, not locale", () => {
  // OAuth requires byte-value ordering; locale-based sort can differ.
  const params = {
    z_param: "last",
    a_param: "first",
    m_param: "middle",
  };
  expect(buildParamString(params)).toEqual("a_param=first&m_param=middle&z_param=last");
});

test("buildParamString: percent-encodes keys and values", () => {
  const params = { "a key": "a value" };
  expect(buildParamString(params)).toEqual("a%20key=a%20value");
});

// OAuth 1.0 community test vector (http://oauth.net/core/1.0/#anchor14):
//   Method  : GET
//   URL     : http://photos.example.net/photos?file=vacation.jpg&size=original
//   Sorted params (oauth + query):
//     file, oauth_consumer_key, oauth_nonce, oauth_signature_method,
//     oauth_timestamp, oauth_token, oauth_version, size
test("buildParamString: produces correct string for OAuth community test vector", () => {
  const params: Record<string, string> = {
    oauth_version: "1.0",
    oauth_consumer_key: "dpf43f3p2l4k3l03",
    oauth_token: "nnch734d00sl2jdk",
    oauth_timestamp: "1191242096",
    oauth_nonce: "kllo9940pd9333jh",
    oauth_signature_method: "HMAC-SHA1",
    file: "vacation.jpg",
    size: "original",
  };
  const expected =
    "file=vacation.jpg" +
    "&oauth_consumer_key=dpf43f3p2l4k3l03" +
    "&oauth_nonce=kllo9940pd9333jh" +
    "&oauth_signature_method=HMAC-SHA1" +
    "&oauth_timestamp=1191242096" +
    "&oauth_token=nnch734d00sl2jdk" +
    "&oauth_version=1.0" +
    "&size=original";
  expect(buildParamString(params)).toEqual(expected);
});

// ---------------------------------------------------------------------------
// buildOAuthHeader — full signature (OAuth community test vector)
// ---------------------------------------------------------------------------
//
// Well-known reference values from the OAuth 1.0 community specification:
//   Consumer key    : dpf43f3p2l4k3l03
//   Consumer secret : kd94hf93k423kf44
//   Token           : nnch734d00sl2jdk
//   Token secret    : pfkkdhi9sl3r4s00
//   Timestamp       : 1191242096
//   Nonce           : kllo9940pd9333jh
//   Method          : GET
//   URL             : http://photos.example.net/photos?file=vacation.jpg&size=original
//   Expected sig    : tR3+Ty81lMeYAr/Fid0kMTYa/WM=

test("buildOAuthHeader: produces correct signature for OAuth community test vector", async () => {
  const creds = {
    consumerKey: "dpf43f3p2l4k3l03",
    consumerSecret: "kd94hf93k423kf44",
    tokenValue: "nnch734d00sl2jdk",
    tokenSecret: "pfkkdhi9sl3r4s00",
  };
  const header = await buildOAuthHeader(
    "GET",
    "http://photos.example.net/photos?file=vacation.jpg&size=original",
    creds,
    { timestamp: "1191242096", nonce: "kllo9940pd9333jh" },
  );

  // The signature value in the header should match the expected Base64 digest,
  // percent-encoded for the Authorization header value.
  // tR3+Ty81lMeYAr/Fid0kMTYa/WM= → tR3%2BTy81lMeYAr%2FFid0kMTYa%2FWM%3D
  const expectedSig = "tR3%2BTy81lMeYAr%2FFid0kMTYa%2FWM%3D";
  const sigMatch = header.match(/oauth_signature="([^"]+)"/);
  expect(sigMatch?.[1], `Full header was: ${header}`).toEqual(expectedSig);
});
