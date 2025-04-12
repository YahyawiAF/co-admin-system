import React, { useState } from 'react';
import Link from 'next/link';
import Head from 'next/head';
import { useLoginMutation } from 'src/api/auth.repo';
import Swal from 'sweetalert2';
import { MdPhone } from "react-icons/md";
import { IoIosLock } from "react-icons/io";
const SignInPage: React.FC = () => {
  const [login, { isLoading }] = useLoginMutation();
  const [formData, setFormData] = useState({
    identifier: '',
    password: '',
    
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
  
    try {
      const user = await login({
        identifier: formData.identifier,
        password: formData.password
      }).unwrap();

      if (user.role === 'USER') {
        sessionStorage.setItem("userID", user.id);
        sessionStorage.setItem("accessToken", user.accessToken);
        sessionStorage.setItem("username", user.fullname ?? "");
        sessionStorage.setItem("role", user.role);
        sessionStorage.setItem("email", user.email ?? ""); // Ajouter cette ligne
        sessionStorage.setItem("phone", user.phoneNumber ?? ""); // Ajouter cette ligne
      
        // Notification de connexion réussie
        await Swal.fire({
          icon: 'success',
          title: 'Connexion réussie !',
          text: 'Redirection en cours...',
          timer: 2000,
          showConfirmButton: false
        });

        window.location.href = '/client/account';
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Accès refusé',
          text: 'this account does not existe',
        });
      }
    } catch (error) {
      console.error('Erreur lors de la connexion:', error);
      Swal.fire({
        icon: 'error',
        title: 'Échec de la connexion',
        text: 'Identifiants incorrects ou accès non autorisé',
      });
    }
  }
  

  return (
    <>
      <Head>
        <title>Sign In</title>
        <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/sweetalert2@11/dist/sweetalert2.min.css" />
      </Head>

      <div className="main">
        <div className="container">
          <div className="signin-content">
            <div className="signin-form">
              <h2 className="form-title">Sign in</h2>
              <form onSubmit={handleSubmit} className="register-form" id="login-form">
              <div className="form-group">
              <label htmlFor="identifier" className="material-icons-name">
      <span role="img" aria-label="phone"><MdPhone /></span>
    </label>
  <input
    type="text" // Changé de email à text
    name="identifier" // Nom modifié
    id="identifier"
    placeholder="  Email or Phone Number"
    value={formData.identifier} // Gardez la même valeur si vous voulez garder le state actuel
    onChange={handleChange}
    required
  />
</div>

                <div className="form-group">
                <label htmlFor="password" className="material-icons-name">
      <span className="emoji-icon" role="img" aria-label="lock"><IoIosLock /></span>
    </label>
                  <input
                    type="password"
                    name="password"
                    id="password"
                    placeholder="Password"
                    value={formData.password}
                    onChange={handleChange}
                    required
                  />
                </div>
                

                <div className="form-group">
                  <input
                    type="checkbox"
                    name="remember-me"
                    id="remember-me"
                    className="agree-term"
                  />
                  <label htmlFor="remember-me" className="label-agree-term">
                    <span><span></span></span>Remember me
                  </label>
                </div>

                <div className="form-group form-button">
                  <input
                    type="submit"
                    name="signin"
                    id="signin"
                    className="form-submit"
                    value="Log in"
                  />
                </div>
              </form>
            </div>

            <div className="signin-image">
              <figure>
                <img 
                  src="/images/signin-image.jpg" 
                  alt="Signin illustration" 
                  style={{ width: '70%', height: 'auto' }}
                />
              </figure>
              <Link 
  href="/client/register" 
  className="signup-image-link"
  style={{ marginRight: '50px' }} 
>
  Don't have an account? Sign Up
</Link>
              
            </div>
          </div>
        </div>
      </div>


    </>
  );
};

export default SignInPage;