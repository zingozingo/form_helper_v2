# backend/core/ai/form_context_analyzer.py

import re
import json
import logging
from typing import Dict, List, Any, Optional, Tuple

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class FormContextAnalyzer:
    """
    A smart analyzer for understanding form context, field relationships,
    and providing enhanced guidance based on form structure.
    """
    
    def __init__(self, knowledge_base_path=None):
        """Initialize with optional custom knowledge base."""
        try:
            # Load enhanced knowledge base - fallback to original if not found
            if knowledge_base_path:
                with open(knowledge_base_path, 'r') as f:
                    self.knowledge_base = json.load(f)
            else:
                try:
                    # Try loading enhanced knowledge base first
                    import os
                    kb_path = os.path.join(os.path.dirname(__file__), "field_knowledge_enhanced.json")
                    with open(kb_path, "r") as f:
                        self.knowledge_base = json.load(f)
                    logger.info("Loaded enhanced knowledge base")
                except FileNotFoundError:
                    # Fall back to original knowledge base
                    kb_path = os.path.join(os.path.dirname(__file__), "field_knowledge.json")
                    with open(kb_path, "r") as f:
                        self.knowledge_base = json.load(f)
                    logger.info("Loaded original knowledge base")
        except Exception as e:
            logger.error(f"Error loading knowledge base: {e}")
            # Create minimal default knowledge base
            self.knowledge_base = {
                "fields": {},
                "common_questions": {},
                "form_types": {}
            }
    
    def analyze_form(self, form_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Analyze form data to enhance context understanding.
        
        Args:
            form_data: Dictionary containing form information
            
        Returns:
            Enhanced form context with additional insights
        """
        # Start with basic form data
        enhanced_context = {
            "form_type": form_data.get("form_type", "unknown"),
            "original_context": form_data,
            "field_count": 0,
            "required_field_count": 0,
            "key_fields": [],
            "field_categories": {},
            "privacy_level": "standard",
            "complexity_level": "medium",
            "estimated_completion_time": "5-10 minutes",
            "field_relationships": {}
        }
        
        # Extract fields and analyze
        fields = form_data.get("fields", [])
        enhanced_context["field_count"] = len(fields)
        
        # Count required fields
        required_fields = [f for f in fields if f.get("required", False)]
        enhanced_context["required_field_count"] = len(required_fields)
        
        # Determine form type if not specified
        if enhanced_context["form_type"] == "unknown":
            detected_type, confidence = self._detect_form_type(fields)
            enhanced_context["form_type"] = detected_type
            enhanced_context["form_type_confidence"] = confidence
        
        # Extract key fields
        enhanced_context["key_fields"] = self._identify_key_fields(fields, enhanced_context["form_type"])
        
        # Categorize fields
        enhanced_context["field_categories"] = self._categorize_fields(fields)
        
        # Determine privacy level
        enhanced_context["privacy_level"] = self._assess_privacy_level(fields)
        
        # Estimate complexity and completion time
        enhanced_context["complexity_level"] = self._assess_complexity(fields)
        enhanced_context["estimated_completion_time"] = self._estimate_completion_time(fields)
        
        # Analyze field relationships
        enhanced_context["field_relationships"] = self._analyze_field_relationships(fields)
        
        # Add form type information from knowledge base if available
        form_type_info = self.knowledge_base.get("form_types", {}).get(enhanced_context["form_type"], {})
        if form_type_info:
            enhanced_context["form_type_info"] = form_type_info
        
        return enhanced_context
    
    def get_field_context(self, field_name: str, field_type: str, form_context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Get enhanced context for a specific field.
        
        Args:
            field_name: Name of the field
            field_type: Type of the field
            form_context: The form context data
            
        Returns:
            Enhanced field context with additional insights
        """
        # Start with basic field information
        field_context = {
            "name": field_name,
            "type": field_type,
            "form_type": form_context.get("form_type", "unknown")
        }
        
        # Add knowledge base information if available
        field_kb = self.knowledge_base.get("fields", {}).get(field_name.lower(), None)
        if not field_kb:
            field_kb = self.knowledge_base.get("fields", {}).get(field_type.lower(), None)
        
        if field_kb:
            field_context.update({
                "purpose": field_kb.get("purpose", ""),
                "format": field_kb.get("format", ""),
                "examples": field_kb.get("examples", ""),
                "importance": field_kb.get("importance", ""),
                "privacy_implications": field_kb.get("privacy_implications", ""),
                "common_mistakes": field_kb.get("common_mistakes", "")
            })
        
        # Find this field in the form data
        fields = form_context.get("original_context", {}).get("fields", [])
        field_data = next((f for f in fields if f.get("name") == field_name), None)
        
        if field_data:
            # Add field data from the form
            field_context.update({
                "required": field_data.get("required", False),
                "label": field_data.get("label", field_name),
                "placeholder": field_data.get("placeholder", ""),
                "validation": field_data.get("validation", {})
            })
        
        # Add relationship information
        relationships = form_context.get("field_relationships", {}).get(field_name, [])
        if relationships:
            field_context["relationships"] = relationships
        
        # Check if this is a key field
        field_context["is_key_field"] = field_name in form_context.get("key_fields", [])
        
        return field_context
    
    def enhance_question_context(self, question: str, field_context: Optional[Dict[str, Any]], form_context: Optional[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Analyze a question to enhance the context for better AI responses.
        
        Args:
            question: The user's question
            field_context: Optional context about the specific field
            form_context: Optional context about the form
            
        Returns:
            Enhanced context for the question
        """
        question_lower = question.lower()
        
        # Start with basic context
        enhanced_context = {
            "question_type": self._classify_question_type(question),
            "entities": self._extract_entities(question),
            "sentiment": self._analyze_sentiment(question),
            "original_question": question
        }
        
        # Add field context if available
        if field_context:
            enhanced_context["field_context"] = field_context
        
        # Add form context if available
        if form_context:
            enhanced_context["form_context"] = form_context
        
        # Check if this is a common question with a standard answer
        for pattern, response in self.knowledge_base.get("common_questions", {}).items():
            if pattern in question_lower:
                enhanced_context["common_question_match"] = pattern
                enhanced_context["standard_response"] = response
                break
        
        # Determine if this is about privacy, security, purpose, format, etc.
        focus_areas = []
        privacy_terms = ["privacy", "secure", "security", "share", "shared", "protect", "safe", "data"]
        format_terms = ["format", "enter", "input", "valid", "correctly", "proper", "example"]
        purpose_terms = ["why", "purpose", "reason", "what for", "needed", "necessary"]
        
        if any(term in question_lower for term in privacy_terms):
            focus_areas.append("privacy")
        if any(term in question_lower for term in format_terms):
            focus_areas.append("format")
        if any(term in question_lower for term in purpose_terms):
            focus_areas.append("purpose")
        
        enhanced_context["focus_areas"] = focus_areas
        
        return enhanced_context
    
    def _detect_form_type(self, fields: List[Dict[str, Any]]) -> Tuple[str, float]:
        """
        Detect the likely form type based on field patterns.
        
        Args:
            fields: List of field dictionaries
            
        Returns:
            Tuple of (form_type, confidence)
        """
        # Extract field names and types for easier matching
        field_names = [f.get("name", "").lower() for f in fields]
        field_types = [f.get("type", "").lower() for f in fields]
        
        # Initialize scores for different form types
        scores = {
            "login": 0.0,
            "registration": 0.0,
            "contact": 0.0,
            "payment": 0.0,
            "shipping": 0.0,
            "subscription": 0.0,
            "survey": 0.0,
            "job_application": 0.0
        }
        
        # Check for login form patterns
        if ("email" in field_names or "username" in field_names) and "password" in field_names and len(fields) <= 3:
            scores["login"] += 0.8
        
        # Check for registration form patterns
        if "email" in field_names and "password" in field_names and ("confirm" in " ".join(field_names) or "name" in field_names) and len(fields) >= 3:
            scores["registration"] += 0.7
        if "username" in field_names and "password" in field_names and len(fields) >= 3:
            scores["registration"] += 0.6
        
        # Check for contact form patterns
        if "name" in field_names and "email" in field_names and ("message" in field_names or "comment" in field_names or "subject" in field_names):
            scores["contact"] += 0.8
        
        # Check for payment form patterns
        card_terms = ["card", "credit", "payment", "cc", "cvv", "cvc"]
        if any(term in " ".join(field_names) for term in card_terms):
            scores["payment"] += 0.7
        if "expiration" in " ".join(field_names) or "expiry" in " ".join(field_names):
            scores["payment"] += 0.2
        
        # Check for shipping form patterns
        address_terms = ["address", "street", "city", "state", "zip", "postal", "country"]
        if sum(term in " ".join(field_names) for term in address_terms) >= 3:
            scores["shipping"] += 0.7
        
        # Check for subscription form patterns
        if "email" in field_names and len(fields) <= 3 and not "password" in field_names:
            scores["subscription"] += 0.6
        
        # Check for survey form patterns
        if "radio" in field_types or "checkbox" in field_types:
            if sum(1 for t in field_types if t in ["radio", "checkbox", "select"]) >= 3:
                scores["survey"] += 0.6
        
        # Check for job application form patterns
        job_terms = ["resume", "cv", "cover", "education", "experience", "qualification"]
        if any(term in " ".join(field_names) for term in job_terms):
            scores["job_application"] += 0.7
        
        # Get the form type with the highest score
        if all(score == 0 for score in scores.values()):
            return "unknown", 0.0
        
        best_type = max(scores.items(), key=lambda x: x[1])
        return best_type[0], best_type[1]
    
    def _identify_key_fields(self, fields: List[Dict[str, Any]], form_type: str) -> List[str]:
        """
        Identify key fields for the form based on form type and field attributes.
        
        Args:
            fields: List of field dictionaries
            form_type: Type of the form
            
        Returns:
            List of key field names
        """
        # Get field names
        field_names = [f.get("name", "") for f in fields]
        
        # Get required fields
        required_fields = [f.get("name", "") for f in fields if f.get("required", False)]
        
        # Based on form type, certain fields are typically key
        key_fields = []
        
        # Common key fields by form type
        form_type_key_fields = {
            "login": ["email", "username", "password"],
            "registration": ["email", "username", "password", "name"],
            "contact": ["email", "name", "message", "subject"],
            "payment": ["credit_card", "card_number", "cvv", "expiration", "name"],
            "shipping": ["name", "address", "city", "state", "zip", "country"],
            "subscription": ["email", "name"],
            "survey": [],  # Depends on survey content
            "job_application": ["name", "email", "resume", "cover_letter"]
        }
        
        # Add form-type specific key fields if they exist in the form
        type_keys = form_type_key_fields.get(form_type, [])
        for key in type_keys:
            for field in field_names:
                if key in field.lower() and field not in key_fields:
                    key_fields.append(field)
        
        # Add any required fields not already included
        for field in required_fields:
            if field not in key_fields:
                key_fields.append(field)
        
        return key_fields
    
    def _categorize_fields(self, fields: List[Dict[str, Any]]) -> Dict[str, List[str]]:
        """
        Categorize fields into logical groups.
        
        Args:
            fields: List of field dictionaries
            
        Returns:
            Dictionary of field categories and their fields
        """
        categories = {
            "personal_information": [],
            "contact_information": [],
            "account_credentials": [],
            "address_information": [],
            "payment_information": [],
            "preferences": [],
            "professional_information": [],
            "other": []
        }
        
        for field in fields:
            field_name = field.get("name", "").lower()
            field_type = field.get("type", "").lower()
            
            # Categorize by field name patterns
            if any(term in field_name for term in ["name", "first", "last", "gender", "dob", "birth", "ssn", "social"]):
                categories["personal_information"].append(field.get("name", ""))
            elif any(term in field_name for term in ["email", "phone", "tel", "mobile", "fax"]):
                categories["contact_information"].append(field.get("name", ""))
            elif any(term in field_name for term in ["password", "username", "login", "confirm"]):
                categories["account_credentials"].append(field.get("name", ""))
            elif any(term in field_name for term in ["address", "street", "city", "state", "zip", "postal", "country"]):
                categories["address_information"].append(field.get("name", ""))
            elif any(term in field_name for term in ["card", "credit", "payment", "cvv", "expir", "billing"]):
                categories["payment_information"].append(field.get("name", ""))
            elif any(term in field_name for term in ["preference", "option", "setting", "subscribe", "newsletter"]):
                categories["preferences"].append(field.get("name", ""))
            elif any(term in field_name for term in ["company", "job", "title", "position", "employer", "resume", "cv"]):
                categories["professional_information"].append(field.get("name", ""))
            else:
                categories["other"].append(field.get("name", ""))
        
        # Remove empty categories
        return {k: v for k, v in categories.items() if v}
    
    def _assess_privacy_level(self, fields: List[Dict[str, Any]]) -> str:
        """
        Assess the privacy sensitivity level of the form.
        
        Args:
            fields: List of field dictionaries
            
        Returns:
            Privacy level: "low", "standard", "high", or "very high"
        """
        # Count fields in different sensitivity categories
        low_sensitivity = 0
        medium_sensitivity = 0
        high_sensitivity = 0
        very_high_sensitivity = 0
        
        for field in fields:
            field_name = field.get("name", "").lower()
            
            # Very high sensitivity fields (financial, legal identifiers)
            if any(term in field_name for term in ["ssn", "social security", "passport", "credit", "card", "cvv", "tax"]):
                very_high_sensitivity += 1
            # High sensitivity fields (personal identifiers)
            elif any(term in field_name for term in ["password", "dob", "birth", "driver", "license", "income"]):
                high_sensitivity += 1
            # Medium sensitivity fields (contact information)
            elif any(term in field_name for term in ["name", "email", "phone", "address", "city", "zip"]):
                medium_sensitivity += 1
            # Low sensitivity fields (preferences, general info)
            else:
                low_sensitivity += 1
        
        # Determine overall privacy level
        if very_high_sensitivity > 0:
            return "very high"
        elif high_sensitivity > 0:
            return "high"
        elif medium_sensitivity > 0:
            return "standard"
        else:
            return "low"
    
    def _assess_complexity(self, fields: List[Dict[str, Any]]) -> str:
        """
        Assess the complexity level of the form.
        
        Args:
            fields: List of field dictionaries
            
        Returns:
            Complexity level: "simple", "medium", "complex", or "very complex"
        """
        # Base complexity on number of fields and types
        field_count = len(fields)
        complex_field_types = ["file", "date", "select", "textarea"]
        complex_fields = sum(1 for f in fields if f.get("type", "") in complex_field_types)
        required_fields = sum(1 for f in fields if f.get("required", False))
        
        # Calculate complexity score
        complexity_score = field_count * 0.5 + complex_fields * 1.5 + required_fields * 0.8
        
        # Determine complexity level
        if complexity_score < 5:
            return "simple"
        elif complexity_score < 15:
            return "medium"
        elif complexity_score < 30:
            return "complex"
        else:
            return "very complex"
    
    def _estimate_completion_time(self, fields: List[Dict[str, Any]]) -> str:
        """
        Estimate time to complete the form.
        
        Args:
            fields: List of field dictionaries
            
        Returns:
            Estimated completion time range
        """
        # Base estimate on number and complexity of fields
        field_count = len(fields)
        complex_field_types = ["file", "date", "textarea"]
        complex_fields = sum(1 for f in fields if f.get("type", "") in complex_field_types)
        
        # Calculate time in minutes (rough estimate)
        base_time = field_count * 0.3  # ~20 seconds per simple field
        complex_time = complex_fields * 1.0  # ~1 minute per complex field
        total_time = base_time + complex_time
        
        # Round up and provide a range
        if total_time < 2:
            return "1-2 minutes"
        elif total_time < 5:
            return "2-5 minutes"
        elif total_time < 10:
            return "5-10 minutes"
        elif total_time < 20:
            return "10-20 minutes"
        else:
            return "20+ minutes"
    
    def _analyze_field_relationships(self, fields: List[Dict[str, Any]]) -> Dict[str, List[Dict[str, str]]]:
        """
        Analyze relationships between fields.
        
        Args:
            fields: List of field dictionaries
            
        Returns:
            Dictionary of field relationships
        """
        relationships = {}
        
        # Get field names
        field_names = [f.get("name", "") for f in fields]
        
        # Define common field relationships
        related_pairs = [
            ("first_name", "last_name", "Personal name components"),
            ("email", "confirm_email", "Email verification pair"),
            ("password", "confirm_password", "Password verification pair"),
            ("address", "city", "Address components"),
            ("city", "state", "Geographic location components"),
            ("state", "zip", "Geographic location components"),
            ("country", "zip", "Geographic location components"),
            ("credit_card", "cvv", "Payment security components"),
            ("credit_card", "expiration", "Payment components")
        ]
        
        # Look for pattern-based relationships
        for name1 in field_names:
            relationships[name1] = []
            
            # Check name-based relationships
            for prefix1, prefix2, rel_type in related_pairs:
                if prefix1 in name1.lower():
                    for name2 in field_names:
                        if name2 != name1 and prefix2 in name2.lower():
                            relationships[name1].append({
                                "field": name2,
                                "relationship_type": rel_type
                            })
            
            # Check for complementary fields (fields that go together)
            common_prefixes = {
                "billing_": "shipping_",
                "shipping_": "billing_",
                "current_": "new_",
                "new_": "current_"
            }
            
            for prefix, complement in common_prefixes.items():
                if name1.lower().startswith(prefix):
                    base_name = name1[len(prefix):]
                    complement_name = f"{complement}{base_name}"
                    if complement_name in field_names:
                        relationships[name1].append({
                            "field": complement_name,
                            "relationship_type": "Complementary information"
                        })
        
        return relationships
    
    def _classify_question_type(self, question: str) -> str:
        """
        Classify the type of question being asked.
        
        Args:
            question: The user's question
            
        Returns:
            Question type classification
        """
        question_lower = question.lower()
        
        # Check for different question types
        if any(word in question_lower for word in ["what", "explain", "describe", "tell me about"]):
            return "informational"
        elif any(word in question_lower for word in ["why", "reason", "purpose", "need"]):
            return "purpose"
        elif any(word in question_lower for word in ["how", "format", "enter", "input"]):
            return "procedural"
        elif any(word in question_lower for word in ["security", "secure", "privacy", "safe", "protected"]):
            return "security"
        elif "required" in question_lower or "mandatory" in question_lower or "optional" in question_lower:
            return "requirement"
        elif "example" in question_lower or "sample" in question_lower:
            return "example_request"
        else:
            return "general"
    
    def _extract_entities(self, question: str) -> Dict[str, Any]:
        """
        Extract key entities from the question.
        
        Args:
            question: The user's question
            
        Returns:
            Dictionary of extracted entities
        """
        entities = {
            "fields": [],
            "form_types": [],
            "actions": []
        }
        
        # Extract field references
        field_terms = self.knowledge_base.get("fields", {}).keys()
        for field in field_terms:
            if field in question.lower():
                entities["fields"].append(field)
        
        # Extract form type references
        form_types = self.knowledge_base.get("form_types", {}).keys()
        for form_type in form_types:
            if form_type in question.lower():
                entities["form_types"].append(form_type)
        
        # Extract action references
        actions = ["submit", "save", "fill", "enter", "complete", "validate"]
        for action in actions:
            if action in question.lower():
                entities["actions"].append(action)
        
        return entities
    
    def _analyze_sentiment(self, question: str) -> Dict[str, Any]:
        """
        Analyze sentiment and urgency in the question.
        
        Args:
            question: The user's question
            
        Returns:
            Dictionary with sentiment analysis
        """
        question_lower = question.lower()
        
        # Simple sentiment analysis
        concern_indicators = ["worried", "concern", "problem", "issue", "error", "wrong", "confused", "don't understand"]
        urgency_indicators = ["urgent", "quickly", "asap", "immediate", "now", "hurry", "deadline"]
        frustration_indicators = ["frustrated", "annoying", "stupid", "ridiculous", "waste", "irritating"]
        
        sentiment = {
            "concern_level": "low",
            "urgency": "normal",
            "frustration": "low"
        }
        
        # Check for concern level
        if any(word in question_lower for word in concern_indicators):
            sentiment["concern_level"] = "high"
        
        # Check for urgency
        if any(word in question_lower for word in urgency_indicators):
            sentiment["urgency"] = "high"
        
        # Check for frustration
        if any(word in question_lower for word in frustration_indicators):
            sentiment["frustration"] = "high"
        
        # Check for question marks (multiple might indicate urgency/frustration)
        question_mark_count = question.count('?')
        if question_mark_count > 1:
            sentiment["emphasis"] = "high"
        else:
            sentiment["emphasis"] = "normal"
        
        return sentiment