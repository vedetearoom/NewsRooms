import unittest

from app.services.activation_code_service import code_hint, normalize_activation_code


class ActivationCodeUtilityTests(unittest.TestCase):
    def test_normalizes_hyphenated_and_spaced_codes(self):
        self.assertEqual(normalize_activation_code(" nr-abcd 1234 "), "NRABCD1234")

    def test_code_hint_keeps_prefix_and_suffix_only(self):
        self.assertEqual(code_hint("NR-ABCD-1234"), "NR***1234")


if __name__ == "__main__":
    unittest.main()
