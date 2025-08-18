import React, { useState } from "react";
import Link from "next/link";
import Head from "next/head";
import { useSignUpMutation } from "src/api/auth.repo";
import { Role } from "src/types/shared";
import Swal from "sweetalert2";
import { BiSolidUser } from "react-icons/bi";
import { MdPhone } from "react-icons/md";
import { IoIosLock } from "react-icons/io";
import { CiLock } from "react-icons/ci";

const SignUpPage: React.FC = () => {
  const [signUp, { isLoading }] = useSignUpMutation();
  const [formData, setFormData] = useState({
    name: "",
    identifier: "",
    password: "",
    repeatPassword: "",
    agreeTerms: false,
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.password !== formData.repeatPassword) {
      Swal.fire({
        icon: "error",
        title: "Erreur",
        text: "Les mots de passe ne correspondent pas",
      });
      return;
    }

    if (!formData.agreeTerms) {
      Swal.fire({
        icon: "error",
        title: "Erreur",
        text: "Vous devez accepter les conditions",
      });
      return;
    }

    try {
      const user = await signUp({
        identifier: formData.identifier,
        password: formData.password,
        fullname: formData.name,
        role: Role.USER,
      }).unwrap();

      await Swal.fire({
        icon: "success",
        title: "Inscription réussie !",
        text: "Vous allez être redirigé vers la page de connexion.",
        confirmButtonText: "OK",
      });
      window.location.href = "/client/login";
    } catch (error) {
      console.error("Erreur lors de l'inscription:", error);
      Swal.fire({
        icon: "error",
        title: "Erreur",
        text: "Une erreur est survenue lors de l'inscription",
      });
    }
  };
  return (
    <>
      <Head>
        <title>Sign Up</title>
        <link
          href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </Head>

      <div className="main">
        <div className="container">
          <div className="signup-content">
            <div className="signup-form">
              <h2 className="form-title">Sign up</h2>
              <form
                onSubmit={handleSubmit}
                className="register-form"
                id="register-form"
              >
                <div className="form-group">
                  <label htmlFor="name" className="material-icons-name">
                    <span className="emoji-icon" role="img" aria-label="user">
                      <BiSolidUser />
                    </span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    id="name"
                    placeholder="Your Name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="identifier" className="material-icons-name">
                    <span className="emoji-icon" role="img" aria-label="phone">
                      <MdPhone />
                    </span>
                  </label>
                  <input
                    type="tel"
                    name="identifier"
                    id="identifier"
                    placeholder="phone number"
                    value={formData.identifier}
                    onChange={(e) => {
                      const inputValue = e.target.value;

                      // Si l'utilisateur essaie de supprimer le +216, on l'empêche
                      if (inputValue.length < 4) {
                        setFormData((prev) => ({
                          ...prev,
                          identifier: "+216",
                        }));
                        return;
                      }

                      // On s'assure que le +216 est toujours présent
                      if (!inputValue.startsWith("+216")) {
                        setFormData((prev) => ({
                          ...prev,
                          identifier: "+216",
                        }));
                        return;
                      }

                      // On garde seulement les chiffres après le +216
                      const numericPart = inputValue
                        .substring(4)
                        .replace(/[^0-9]/g, "");

                      // On limite à 8 chiffres maximum après le +216
                      const limitedNumericPart = numericPart.slice(0, 8);

                      setFormData((prev) => ({
                        ...prev,
                        identifier: "+216" + limitedNumericPart,
                      }));
                    }}
                    onFocus={(e) => {
                      // Si le champ est vide, on met +216 par défaut
                      if (!formData.identifier) {
                        setFormData((prev) => ({
                          ...prev,
                          identifier: "+216",
                        }));
                      }
                    }}
                    className={`w-full p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      formData.identifier.length !== 12
                        ? "border-red-500"
                        : "border-gray-300"
                    }`}
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="password" className="material-icons-name">
                    <span className="emoji-icon" role="img" aria-label="lock">
                      <IoIosLock />
                    </span>
                  </label>
                  <input
                    type="password"
                    name="password"
                    id="password"
                    placeholder="Your Password"
                    value={formData.password}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="form-group">
                  <label
                    htmlFor="repeatPassword"
                    className="material-icons-name"
                  >
                    <span className="emoji-icon" role="img" aria-label="lock">
                      <CiLock />
                    </span>
                  </label>
                  <input
                    type="password"
                    name="repeatPassword"
                    id="repeatPassword"
                    placeholder="Repeat Password"
                    value={formData.repeatPassword}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="form-group">
                  <input
                    type="checkbox"
                    name="agreeTerms"
                    id="agreeTerms"
                    className="agree-term"
                    checked={formData.agreeTerms}
                    onChange={handleChange}
                  />
                  <label htmlFor="agreeTerms" className="label-agree-term">
                    <span>
                      <span></span>
                    </span>
                    I agree all statements in{" "}
                    <a href="#" className="term-service">
                      Terms of service
                    </a>
                  </label>
                </div>

                <div className="form-group form-button">
                  <input
                    type="submit"
                    name="signup"
                    id="signup"
                    className="form-submit"
                    value="Register"
                  />
                </div>
              </form>
            </div>

            <div className="signup-image">
              <figure>
                <img
                  src="/images/signup-image.jpg"
                  alt="Signup illustration"
                  style={{ width: "100%", height: "auto" }}
                />
              </figure>
              <Link href="/client/login" className="signup-image-link">
                I am already member
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default SignUpPage;
